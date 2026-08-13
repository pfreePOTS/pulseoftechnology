"""
Topic positioning trends: article velocity (configurable windows) + optional DeepSeek synthesis.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..models.article import Article
from ..models.topic import Topic, TopicStatus
from ..services.signal_service import _article_coverage_time
from ..services.topic_serializers import topic_domain_short
from .ai_service import HAIKU_MODEL
from .llm_client import LLMAPIError, chat_completion, is_llm_configured
from .pipeline_settings import merge_pipeline_settings

logger = logging.getLogger(__name__)

Trend = Literal["up", "down", "flat"]


def _velocity_trend(recent_n: int, prior_n: int) -> Trend:
    """Heuristic trend from article ingestion counts only."""
    if recent_n == 0 and prior_n == 0:
        return "flat"
    if prior_n == 0 and recent_n > 0:
        return "up"
    if recent_n == 0 and prior_n > 0:
        return "down"
    ratio = recent_n / prior_n
    if ratio >= 1.2:
        return "up"
    if ratio <= 0.8:
        return "down"
    return "flat"


def _window_counts(
    db: Session,
    topic_ids: list[int],
    start: datetime,
    end: datetime,
) -> dict[int, int]:
    """Count articles per topic in [start, end) using coverage time (matches velocity metrics)."""
    if not topic_ids:
        return {}
    ct = _article_coverage_time()
    rows = (
        db.query(Article.topic_id, func.count(Article.id))
        .filter(
            Article.topic_id.in_(topic_ids),
            ct >= start,
            ct < end,
            Article.archived_at.is_(None),
        )
        .group_by(Article.topic_id)
        .all()
    )
    return {int(tid): int(n) for tid, n in rows}


def _sample_titles(
    db: Session,
    topic_id: int,
    start: datetime,
    end: datetime,
    limit: int,
) -> list[str]:
    ct = _article_coverage_time()
    q = (
        db.query(Article.title)
        .filter(
            Article.topic_id == topic_id,
            ct >= start,
            ct < end,
            Article.archived_at.is_(None),
        )
        .order_by(ct.desc())
        .limit(limit)
    )
    return [r[0] for r in q.all() if r[0]]


def _trend_system_prompt(trend_window_days: int, trend_prior_window_days: int) -> str:
    return f"""\
You are a technology intelligence analyst. Each item describes press coverage of one trend topic.
Compare the last {trend_window_days} days vs the {trend_prior_window_days} days before that:
article volume, velocity of publication, and whether titles suggest escalating alarm,
urgency, crisis, optimism, or fading interest. Weight emotional intensity alongside
raw volume — a small number of alarming articles can outweigh a large number of routine ones.

Respond with valid JSON only — no markdown. Schema:
{{"insights": [
  {{"topic_id": <int>, "overall": "up" | "down" | "flat",
   "label": "<=8 words, e.g. Rising coverage · sharper tone>",
   "note": "<=2 short sentences; mention volume and tone if visible>"}}
]}}
You must include exactly one object per topic_id from the input — no omissions, no extras."""


_INSIGHTS_PARSE_FAIL = "Could not parse AI response; showing volume-based trend only."


def _call_ai_insights(
    payload_topics: list[dict[str, Any]],
    *,
    trend_window_days: int,
    trend_prior_window_days: int,
) -> dict[int, dict[str, str]] | None:
    if not is_llm_configured() or not payload_topics:
        return None
    user = json.dumps({"topics": payload_topics}, indent=2)
    system = _trend_system_prompt(trend_window_days, trend_prior_window_days)
    try:
        text = chat_completion(
            HAIKU_MODEL,
            system=system,
            user=user,
            max_tokens=2048,
        )
        data = json.loads(text)
        out: dict[int, dict[str, str]] = {}
        for row in data.get("insights", []):
            tid = row.get("topic_id")
            if tid is None:
                continue
            o = row.get("overall", "flat")
            if o not in ("up", "down", "flat"):
                o = "flat"
            out[int(tid)] = {
                "overall": o,
                "label": str(row.get("label", ""))[:120],
                "note": str(row.get("note", ""))[:400],
            }
        return out if out else None
    except (LLMAPIError, json.JSONDecodeError, KeyError, TypeError, ValueError):
        logger.exception("Positioning trend AI call failed")
        return None


def build_positioning_insights(
    db: Session,
    *,
    status: TopicStatus = TopicStatus.selected,
    max_topics: int = 40,
) -> list[dict[str, Any]]:
    """
    Return one insight dict per topic with velocity windows + merged AI label (when available).
    """
    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    pw = merged.trend_prior_window_days

    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    prior_end = recent_start
    prior_start = now - timedelta(days=tw + pw)

    topics: list[Topic] = (
        db.query(Topic)
        .options(joinedload(Topic.domain))
        .filter(Topic.status == status)
        .order_by(Topic.urgency_score.desc())
        .limit(max_topics)
        .all()
    )
    if not topics:
        return []

    topic_ids = [t.id for t in topics]
    total_rows = (
        db.query(Article.topic_id, func.count(Article.id))
        .filter(
            Article.topic_id.in_(topic_ids),
            Article.archived_at.is_(None),
        )
        .group_by(Article.topic_id)
        .all()
    )
    total_by_topic = {int(tid): int(n) for tid, n in total_rows}

    recent_c = _window_counts(db, topic_ids, recent_start, now + timedelta(seconds=1))
    prior_c = _window_counts(db, topic_ids, prior_start, prior_end)

    ai_payload: list[dict[str, Any]] = []
    for t in topics:
        rid = t.id
        rn = recent_c.get(rid, 0)
        pn = prior_c.get(rid, 0)
        ai_payload.append(
            {
                "topic_id": rid,
                "name": t.name,
                "domain": topic_domain_short(t),
                "topic_urgency_score": round(t.urgency_score, 2),
                f"articles_ingested_last_{tw}d": rn,
                f"articles_ingested_prior_{pw}d": pn,
                "recent_sample_titles": _sample_titles(
                    db, rid, recent_start, now + timedelta(seconds=1), 5
                ),
                "prior_sample_titles": _sample_titles(db, rid, prior_start, prior_end, 5),
            }
        )

    ai_by_id = _call_ai_insights(
        ai_payload,
        trend_window_days=tw,
        trend_prior_window_days=pw,
    )

    results: list[dict[str, Any]] = []
    for t in topics:
        rid = t.id
        rn = recent_c.get(rid, 0)
        pn = prior_c.get(rid, 0)
        base = _velocity_trend(rn, pn)
        label = "Volume " + ("↑" if base == "up" else "↓" if base == "down" else "→")
        note = f"Last {tw}d: {rn} article(s) ingested vs prior {pw}d: {pn}."
        ai_enriched = False

        if ai_by_id and rid in ai_by_id:
            row = ai_by_id[rid]
            trend: Trend = row["overall"]  # type: ignore[assignment]
            if trend not in ("up", "down", "flat"):
                trend = base
            label = row.get("label") or label
            note = row.get("note") or note
            ai_enriched = True
        else:
            trend = base

        results.append(
            {
                "topic_id": rid,
                "name": t.name,
                "domain": topic_domain_short(t),
                "urgency_score": t.urgency_score,
                "article_count": total_by_topic.get(rid, 0),
                "articles_primary_window": rn,
                "articles_prior_window": pn,
                "primary_window_days": tw,
                "prior_window_days": pw,
                "trend": trend,
                "label": label,
                "note": note,
                "ai_enriched": ai_enriched,
            }
        )

    return results


def build_hot_of_day(db: Session) -> dict[str, Any]:
    """
    Among **on-radar** topics (``selected``), pick the topic with the highest article count
    in the primary trend window (coverage time). Tie-break: higher ``urgency_score``, then
    lower ``topic_id``.

    **Hot article**: the most recently *ingested* article tied to that topic within the same
    window (among rows matching the count query).
    """
    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    ct = _article_coverage_time()

    topics: list[Topic] = (
        db.query(Topic)
        .options(joinedload(Topic.domain))
        .filter(Topic.status == TopicStatus.selected)
        .order_by(Topic.urgency_score.desc(), Topic.id.asc())
        .all()
    )
    # Other is not a radar preference pillar — never promote it as the shared hot lead.
    topics = [
        t
        for t in topics
        if (topic_domain_short(t) or "").strip().lower() != "other"
        and (getattr(getattr(t, "domain", None), "slug", None) or "").lower() != "other"
    ]
    empty: dict[str, Any] = {
        "trend_window_days": tw,
        "hot_topic": None,
        "articles_in_window": 0,
        "hot_article": None,
    }
    if not topics:
        return empty

    topic_ids = [t.id for t in topics]
    recent_c = _window_counts(db, topic_ids, recent_start, now)

    max_n = max(recent_c.values(), default=0)
    if max_n == 0:
        return empty

    hot_topic_row: Topic | None = None
    for t in topics:
        if recent_c.get(t.id, 0) == max_n:
            hot_topic_row = t
            break

    if hot_topic_row is None:
        return empty

    hot_art = (
        db.query(Article)
        .options(joinedload(Article.source))
        .filter(
            Article.topic_id == hot_topic_row.id,
            Article.archived_at.is_(None),
            ct >= recent_start,
            ct < now,
        )
        .order_by(Article.ingested_at.desc())
        .first()
    )

    hot_article_out: dict[str, Any] | None = None
    if hot_art is not None:
        img_u = (getattr(hot_art, "image_url", None) or "").strip()
        hot_article_out = {
            "id": hot_art.id,
            "title": hot_art.title,
            "url": hot_art.url,
            "published_at": hot_art.published_at,
            "ingested_at": hot_art.ingested_at,
            "source_name": hot_art.source.name if hot_art.source else None,
            "image_url": img_u or None,
            "what_is_it": hot_art.what_is_it,
            "why_it_matters": hot_art.why_it_matters,
        }

    return {
        "trend_window_days": tw,
        "hot_topic": {
            "id": hot_topic_row.id,
            "name": hot_topic_row.name,
            "domain": topic_domain_short(hot_topic_row),
            "subdomain": getattr(hot_topic_row, "subdomain", None) or "",
            "urgency_score": hot_topic_row.urgency_score,
        },
        "articles_in_window": max_n,
        "hot_article": hot_article_out,
    }


def newsletter_topic_velocity_trend(db: Session, topic_id: int) -> Trend:
    """
    Newsletter “Trending” badge: compares article volume in the configured primary window
    vs the prior window (same basis as Research velocity / positioning insights).
    """
    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    pw = merged.trend_prior_window_days
    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    prior_end = recent_start
    prior_start = now - timedelta(days=tw + pw)
    recent_n = _window_counts(db, [topic_id], recent_start, now).get(topic_id, 0)
    prior_n = _window_counts(db, [topic_id], prior_start, prior_end).get(topic_id, 0)
    return _velocity_trend(recent_n, prior_n)
