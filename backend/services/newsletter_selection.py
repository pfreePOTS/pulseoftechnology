"""
Rank and pick articles for newsletter deep dives.

Selection is **content- and persona-driven**, not template-driven:

- Topic domains are narrowed in ``assemble_newsletter_topics``
  (`email_service`): domain picks first, then a **fallback ladder** (industry / persona /
  ingest freshness vs all-pipeline topics) guarantees a minimally sized pool when ingest is thin.
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
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..models.article import Article
from ..models.role import Role
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


def article_has_persona_for_roles(article: Article, role_names: list[str] | None) -> bool:
    """Whether ``article.persona_impacts`` has substantive text for one of ``role_names``."""
    if not role_names:
        return True
    return any(_persona_line_for_role(article, rn) for rn in role_names)


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


# ── Recommended-path / “Today’s topics” (reuse newsletter scoring) ───────────

# Recent window for ranking topics by their best in-window article (aligns with teaser).
RECOMMENDED_PATH_ARTICLE_LOOKBACK = timedelta(hours=96)
_INDSTRY_TEXT_BONUS = 35.0  # boosts when intake industry appears in article prose


def article_industry_bonus(article: Article, industry_needle: str) -> float:
    """Match intake industry (e.g. ``Insurance``) against article text — business-sense fit."""
    needle = (industry_needle or "").strip().lower()
    if len(needle) < 2:
        return 0.0
    parts: list[str] = [
        (article.title or ""),
        (article.what_is_it or ""),
        (article.why_it_matters or ""),
        (article.content or "")[:4000],
    ]
    pi = article.persona_impacts
    if isinstance(pi, dict):
        parts.extend(str(v) for v in pi.values() if v)
    blob = " ".join(parts).lower()
    if needle in blob:
        return _INDSTRY_TEXT_BONUS
    tags = article.tags
    if isinstance(tags, list):
        t_join = " ".join(str(x).lower() for x in tags)
        if needle in t_join:
            return _INDSTRY_TEXT_BONUS * 0.6
    return 0.0


def topic_peak_newsletter_signal_for_recommended(
    db: Session,
    topic: Topic,
    *,
    role_names: list[str] | None,
    industry_needle: str,
    reference_time: datetime,
    article_after: datetime,
    sample_cap: int = 56,
) -> float:
    """Max (newsletter score + industry text bonus) among recent articles under this topic."""
    ctx = NewsletterArticleContext(
        role_names=role_names,
        topic_urgency=float(topic.urgency_score or 0.0),
        reference_time=reference_time,
    )
    q = (
        db.query(Article)
        .filter(
            Article.topic_id == topic.id,
            Article.archived_at.is_(None),
            Article.ingested_at >= article_after,
        )
        .order_by(Article.ingested_at.desc())
        .limit(sample_cap)
    )
    best = 0.0
    for a in q.all():
        if title_contains_hangul(getattr(a, "title", None)):
            continue
        line = score_article_for_newsletter(a, ctx) + article_industry_bonus(a, industry_needle)
        if line > best:
            best = line
    return best


def resolve_role_names_from_intake(intake_role: str, db: Session) -> list[str] | None:
    """
    Map free-text intake titles (``ExecutiveIntakeForm``) to ``Role.name`` values
    so persona_impacts keys line up with newsletter scoring.
    """
    raw = (intake_role or "").strip()
    if not raw:
        return None
    s_low = raw.lower()
    rows = db.query(Role.name).order_by(Role.name).all()
    names = [r[0] for r in rows if r[0]]
    for n in names:
        if n.strip().lower() == s_low:
            return [n]
    out: list[str] = []
    for n in names:
        nl = n.lower()
        if nl and (nl in s_low or s_low in nl):
            out.append(n)
    if out:
        return list(dict.fromkeys(out))
    # Token hints when labels differ (intake "CIO / CTO" vs Role "Chief Technology Officer").
    token_hits: dict[str, str] = {}
    for n in names:
        nl = n.lower()
        for needle in (
            "ciso",
            "cio",
            "cto",
            "cfo",
            "ceo",
            "coo",
            "chief risk",
            "risk officer",
        ):
            if needle in s_low and needle in nl:
                token_hits[n] = n
                break
    return list(token_hits.values()) or None


# Blend article/persona signal into topic ordering — matches public Recommended Path.
NEWSLETTER_TOPIC_SIGNAL_BLEND = 0.22


def industry_radar_bonus(topic: Topic, industry: str) -> float:
    """Boost topics whose title/summary co-mentions sector language."""
    ind = industry.strip().lower()
    if len(ind) < 3:
        return 0.0
    blob = f"{topic.name} {(topic.summary or '')}".lower()
    bonus = 0.0
    if ind in blob:
        bonus += 2.8
    if "transport" in ind:
        for kw in (
            "transport",
            "transportation",
            "logistics",
            "freight",
            "fleet",
            "supply chain",
            "shipping",
            "mobility",
        ):
            if kw in blob:
                bonus += 2.6
                break
    if "health" in ind:
        for kw in ("health", "clinical", "hospital", "patient"):
            if kw in blob:
                bonus += 2.4
                break
    return min(bonus, 6.0)


def recommended_path_topic_base_rank(
    db: Session,
    topic: Topic,
    *,
    industry: str,
    role_names: list[str] | None,
    since: datetime,
    now: datetime,
) -> float:
    """Topic urgency, industry_positions hint, blended fresh-article persona signal."""
    score = float(topic.urgency_score or 0.0)
    ind_l = (industry or "").strip().lower()
    if ind_l:
        ip = topic.industry_positions
        if isinstance(ip, dict):
            for key in ip.keys():
                if ind_l in str(key).lower():
                    score += 2.0
                    break
    peak = topic_peak_newsletter_signal_for_recommended(
        db,
        topic,
        role_names=role_names,
        industry_needle=industry or "",
        reference_time=now,
        article_after=since,
    )
    return score + NEWSLETTER_TOPIC_SIGNAL_BLEND * peak


def recommended_path_topic_total_rank(
    db: Session,
    topic: Topic,
    *,
    industry: str,
    role_names: list[str] | None,
    since: datetime,
    now: datetime,
) -> float:
    """Base rank plus title/summary industry keyword reinforcement (recommended path parity)."""
    return recommended_path_topic_base_rank(
        db, topic, industry=industry, role_names=role_names, since=since, now=now
    ) + industry_radar_bonus(topic, industry)


def newsletter_subscriber_profile_topic_rank(
    db: Session,
    topic: Topic,
    *,
    subscriber: object,
    role_names: list[str] | None,
    article_after: datetime,
    reference_time: datetime | None = None,
) -> float:
    """Max rank across subscriber industries — matches multi-sector executives."""
    now = reference_time or datetime.now(UTC)
    raw_inds = getattr(subscriber, "industries", None) or []
    inds = [str(x).strip() for x in raw_inds if x is not None and str(x).strip()]
    if not inds:
        inds = [""]
    best = float("-inf")
    for ind in inds:
        score = recommended_path_topic_total_rank(
            db, topic, industry=ind, role_names=role_names, since=article_after, now=now
        )
        if score > best:
            best = score
    return best


def sort_topics_for_newsletter_profile(
    db: Session,
    topics: Sequence[Topic],
    subscriber: object,
    role_objs: list,
    *,
    article_after: datetime,
    reference_time: datetime | None = None,
) -> list[Topic]:
    """
    Order briefing topics by profile-aware score (domains already applied upstream).

    Uses the same industry + persona + freshness signals as Recommended Path ordering so
    "Your Radar Briefing" aligns with subscriber industries and roles, not urgency alone.
    """
    names = [(getattr(r, "name", None) or "").strip() for r in role_objs]
    role_names = [n for n in names if n] or None
    now = reference_time or datetime.now(UTC)

    ranked: list[tuple[float, float, int, Topic]] = []
    for t in topics:
        score = newsletter_subscriber_profile_topic_rank(
            db,
            t,
            subscriber=subscriber,
            role_names=role_names,
            article_after=article_after,
            reference_time=now,
        )
        urg = float(t.urgency_score or 0.0)
        tid = getattr(t, "id", 0)
        ranked.append((score, urg, int(tid) if tid is not None else 0, t))

    ranked.sort(key=lambda x: (-x[0], -x[1], -x[2]))
    return [row[3] for row in ranked]
