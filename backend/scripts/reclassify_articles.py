"""
Reclassify articles after a domain registry change.

Run from inside Docker:
    docker compose exec backend python -m backend.scripts.reclassify_articles --full
    docker compose exec backend python -m backend.scripts.reclassify_articles --classify-only
"""

from __future__ import annotations

import argparse
import json
import logging
from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

from backend.database import SessionLocal
from backend.models.article import Article, ArticleStatus
from backend.models.domain import Domain
from backend.models.signal import SignalRecommendation
from backend.models.topic import Topic
from backend.services.ai_service import (
    _node_classify,
    _classification_feedback_context,
    get_active_model,
    process_raw_articles,
    render_classify_system_prompt,
    resolve_domain,
)
from backend.services.domain_registry import slugify_domain

logger = logging.getLogger(__name__)


def _dedup_topics(db: Session) -> int:
    """Merge topics sharing (domain_id, subdomain, name). Returns merge count."""
    rows = db.query(Topic).options(joinedload(Topic.domain)).all()
    groups: dict[tuple[int, str, str], list[Topic]] = defaultdict(list)
    for t in rows:
        key = (t.domain_id, (t.subdomain or "").strip(), t.name)
        groups[key].append(t)

    merges = 0
    for topics in groups.values():
        if len(topics) < 2:
            continue
        topics.sort(key=lambda x: (x.urgency_score, x.id), reverse=True)
        target = topics[0]
        sources = topics[1:]
        max_urgency = target.urgency_score
        for src in sources:
            if src.urgency_score > max_urgency:
                max_urgency = src.urgency_score
            db.query(Article).filter(Article.topic_id == src.id).update(
                {"topic_id": target.id}, synchronize_session=False
            )
            db.query(SignalRecommendation).filter(SignalRecommendation.topic_id == src.id).update(
                {"topic_id": target.id}, synchronize_session=False
            )
            db.delete(src)
            merges += 1
        target.urgency_score = max_urgency
    if merges:
        db.commit()
    return merges


def _canonical_topic_for_reclassify(db: Session, *, topic: Topic, domain_row: Domain) -> Topic:
    """Pick or create the topic row for ``(domain_id, subdomain, name)`` without violating uniqueness."""
    subdomain = (topic.subdomain or "").strip()
    existing = (
        db.query(Topic)
        .filter(
            Topic.domain_id == domain_row.id,
            Topic.subdomain == subdomain,
            Topic.name == topic.name,
        )
        .first()
    )
    if existing is not None:
        return existing
    topic.domain_id = domain_row.id
    db.flush()
    return topic


def _cleanup_orphan_topics(db: Session) -> int:
    orphans = 0
    topics = db.query(Topic).all()
    for topic in topics:
        active = sum(1 for a in topic.articles if a.archived_at is None)
        if active == 0:
            topic.is_published = False
            orphans += 1
    db.commit()
    return orphans


def _classify_only(db: Session) -> dict[str, int]:
    classify_prompt = render_classify_system_prompt(db)
    classify_model = get_active_model(db, "classify")
    feedback = _classification_feedback_context(db)

    articles = (
        db.query(Article)
        .options(joinedload(Article.topic).joinedload(Topic.domain))
        .filter(Article.status.in_([ArticleStatus.processed, ArticleStatus.review]))
        .all()
    )
    reclassified = 0
    topics_created = 0

    for article in articles:
        content = article.content or article.title or ""
        if not content.strip():
            continue
        result = _node_classify(
            content,
            classify_prompt,
            classify_model,
            article_id=article.id,
            feedback_context=feedback,
        )
        domain_row = resolve_domain(db, result.get("domain") or "Other")
        topic = article.topic
        if topic is None:
            topic_name = f"{domain_row.short_label}: General Coverage"
            topic = (
                db.query(Topic)
                .filter(Topic.name == topic_name, Topic.domain_id == domain_row.id)
                .first()
            )
            if topic is None:
                topic = Topic(
                    name=topic_name,
                    domain_id=domain_row.id,
                    subdomain=(result.get("subdomain") or "").strip(),
                    urgency_score=5.0,
                )
                db.add(topic)
                db.flush()
                topics_created += 1
            article.topic_id = topic.id
        elif topic.domain_id != domain_row.id:
            canonical = _canonical_topic_for_reclassify(db, topic=topic, domain_row=domain_row)
            if canonical.id != topic.id:
                article.topic_id = canonical.id
            topic = canonical
        sub = (result.get("subdomain") or "").strip()
        if sub:
            article.subdomain = sub
        reclassified += 1

    db.commit()
    return {"articles_reclassified": reclassified, "topics_created": topics_created}


def _full_reclassify(db: Session) -> dict[str, int]:
    articles = (
        db.query(Article)
        .filter(Article.status.in_([ArticleStatus.processed, ArticleStatus.review]))
        .all()
    )
    reset = 0
    for article in articles:
        article.status = ArticleStatus.raw
        article.topic_id = None
        article.subdomain = ""
        article.what_is_it = None
        article.why_it_matters = None
        article.persona_impacts = None
        reset += 1
    db.commit()

    processed = process_raw_articles(db)
    return {"articles_reset": reset, "articles_processed": processed}


def main() -> None:
    parser = argparse.ArgumentParser(description="Reclassify articles for domain registry changes")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--full",
        action="store_true",
        help="Reset articles to raw and rerun full agentic pipeline (default)",
    )
    mode.add_argument(
        "--classify-only",
        action="store_true",
        help="Re-run classify node only and rebind domain_id (cheaper)",
    )
    args = parser.parse_args()
    use_full = args.full or not args.classify_only

    db = SessionLocal()
    try:
        if use_full:
            stats = _full_reclassify(db)
        else:
            stats = _classify_only(db)
        dedups = _dedup_topics(db)
        orphans = _cleanup_orphan_topics(db)
        summary = {
            **stats,
            "topic_dedups": dedups,
            "topics_orphaned_unpublished": orphans,
            "cost_estimate_usd": None,
        }
        print(json.dumps(summary, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
