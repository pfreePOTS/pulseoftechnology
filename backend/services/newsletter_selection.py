"""
Rank and pick articles for newsletter deep dives.

Selection is **content- and persona-driven**, not template-driven:

- **Topic domains** are already filtered upstream (`assemble_newsletter_topics`) using the
  subscriber's domain picks and/or role domain tags.
- **Article choice within a topic** prefers pieces that have a substantive
  ``persona_impacts[role_name]`` line for one of the subscriber's job titles (Role.name), as
  produced during AI processing. That is the primary signal for "CFO vs CTO" relevance.
  Articles still in ingest (no ``what_is_it`` yet) or with only raw ``content`` remain
  eligible so new links show up in briefings.
- ``article.tags`` are thematic (compliance, EU, …), not domain pillars — they are **not**
  intersected with Role.tags (that was a previous bug).

Tuning: adjust weights below as you add roles and more articles per topic.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models.article import Article
from ..models.topic import Topic
from .article_language import title_contains_hangul

logger = logging.getLogger(__name__)

# --- Scoring weights (tune here) ---
WEIGHT_PERSONA_CHARS = 0.45  # per character of persona-specific line, capped
WEIGHT_PERSONA_CAP = 95.0
WEIGHT_WHY_CHARS = 0.06
WEIGHT_WHY_CAP = 28.0
WEIGHT_RECENCY = 72.0  # max points for very fresh items
WEIGHT_TOPIC_URGENCY = 2.8  # multiplied by topic urgency (1–10)

# When the subscriber has at least one role, articles without a persona line for any of
# those roles are heavily deprioritized (they may still fill slots if nothing else exists).
MISSING_PERSONA_MULTIPLIER = 0.22
MISSING_PERSONA_SUBTRACT = 55.0

# Prefer ingested_at; fall back to published_at for recency.
RECENCY_HALF_LIFE_DAYS = 10.0

DEEP_DIVE_ARTICLE_LIMIT = 3


@dataclass(frozen=True)
class NewsletterArticleContext:
    """Resolved per-send context for scoring."""

    role_names: list[str] | None
    """Exact Role.name values from DB; must match keys in article.persona_impacts when present."""
    topic_urgency: float
    reference_time: datetime


def _persona_line_for_role(article: Article, role_name: str | None) -> str:
    """Return the impact line for this role (case-insensitive key match)."""
    if not role_name:
        return ""
    raw = article.persona_impacts
    if not isinstance(raw, dict):
        return ""
    if role_name in raw and isinstance(raw[role_name], str):
        s = raw[role_name].strip()
        if s:
            return s
    rlow = role_name.lower().strip()
    for k, v in raw.items():
        if isinstance(k, str) and k.lower().strip() == rlow and isinstance(v, str):
            s = v.strip()
            if s:
                return s
    return ""


def _best_persona_line_for_roles(article: Article, role_names: list[str] | None) -> str:
    """Prefer the longest substantive persona line across the subscriber's roles."""
    if not role_names:
        return ""
    best = ""
    for rn in role_names:
        line = _persona_line_for_role(article, rn)
        if len(line) > len(best):
            best = line
    return best


def _article_recency_dt(article: Article) -> datetime | None:
    if article.ingested_at:
        return article.ingested_at
    return article.published_at


def _recency_score(article: Article, ref: datetime) -> float:
    dt = _article_recency_dt(article)
    if dt is None:
        return 0.0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    age_days = max(0.0, (ref - dt).total_seconds() / 86400.0)
    # Exponential decay: score WEIGHT_RECENCY at age 0, ~half at half-life
    return WEIGHT_RECENCY * math.exp(-age_days / RECENCY_HALF_LIFE_DAYS)


def score_article_for_newsletter(article: Article, ctx: NewsletterArticleContext) -> float:
    """
    Higher = better fit for this subscriber/topic. Used for ordering and diagnostics.
    """
    persona = _best_persona_line_for_roles(article, ctx.role_names)
    persona_pts = min(WEIGHT_PERSONA_CAP, len(persona) * WEIGHT_PERSONA_CHARS)

    why = (article.why_it_matters or "").strip()
    why_pts = min(WEIGHT_WHY_CAP, len(why) * WEIGHT_WHY_CHARS)

    rec = _recency_score(article, ctx.reference_time)
    urg = WEIGHT_TOPIC_URGENCY * min(10.0, max(0.0, ctx.topic_urgency))

    raw = persona_pts + why_pts + rec + urg

    if ctx.role_names and not persona:
        raw = raw * MISSING_PERSONA_MULTIPLIER - MISSING_PERSONA_SUBTRACT

    return raw


def select_articles_for_newsletter_topic(
    topic: Topic,
    db: Session,
    role_names: list[str] | None,
    *,
    article_ingested_after: datetime | None = None,
    limit: int = DEEP_DIVE_ARTICLE_LIMIT,
    reference_time: datetime | None = None,
) -> list[Article]:
    """
    Return up to ``limit`` articles for a topic, ranked for the given job title(s).

    When ``role_names`` is set, articles with a persona-specific line for any of those roles
    are preferred; the list may include others only to fill empty slots.
    """
    ref = reference_time or datetime.now(UTC)
    ctx_base = NewsletterArticleContext(
        role_names=role_names,
        topic_urgency=float(topic.urgency_score or 0.0),
        reference_time=ref,
    )

    q = db.query(Article).filter(
        Article.topic_id == topic.id,
        Article.archived_at.is_(None),
    )
    if article_ingested_after is not None:
        q = q.filter(Article.ingested_at >= article_ingested_after)

    raw_candidates: list[Article] = [
        a for a in q.all() if not title_contains_hangul(getattr(a, "title", None))
    ]

    def _any_persona(a: Article) -> bool:
        if not role_names:
            return False
        return any(_persona_line_for_role(a, rn) for rn in role_names)

    if not raw_candidates:
        return []

    scored = [(score_article_for_newsletter(a, ctx_base), a) for a in raw_candidates]
    scored.sort(key=lambda x: x[0], reverse=True)

    if not role_names:
        return [a for _, a in scored[:limit]]

    with_persona = [a for a in raw_candidates if _any_persona(a)]
    persona_sorted = sorted(
        with_persona,
        key=lambda a: score_article_for_newsletter(a, ctx_base),
        reverse=True,
    )
    out: list[Article] = persona_sorted[:limit]

    if len(out) < limit:
        seen = {a.id for a in out}
        for _, a in scored:
            if len(out) >= limit:
                break
            if a.id not in seen:
                seen.add(a.id)
                out.append(a)

    logger.debug(
        "Newsletter topic %s: %d articles for roles %r (%d with dedicated persona line)",
        topic.name,
        len(out),
        role_names,
        len(with_persona),
    )
    return out
