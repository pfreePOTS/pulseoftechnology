"""
Topic positioning trends: article velocity (configurable windows) + optional Haiku synthesis.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import anthropic
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..models.article import Article
from ..models.topic import Topic, TopicStatus
from .pipeline_settings import merge_pipeline_settings

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0].strip()
    return text


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
    if not topic_ids:
        return {}
    rows = (
        db.query(Article.topic_id, func.count(Article.id))
        .filter(
            Article.topic_id.in_(topic_ids),
            Article.ingested_at >= start,
            Article.ingested_at < end,
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
    q = (
        db.query(Article.title)
        .filter(
            Article.topic_id == topic_id,
            Article.ingested_at >= start,
            Article.ingested_at < end,
            Article.archived_at.is_(None),
        )
        .order_by(Article.ingested_at.desc())
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
    if not settings.anthropic_api_key or not payload_topics:
        return None
    user = json.dumps({"topics": payload_topics}, indent=2)
    system = _trend_system_prompt(trend_window_days, trend_prior_window_days)
    try:
        raw = _get_client().messages.create(
            model=HAIKU_MODEL,
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = _strip_fences(raw.content[0].text)
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
    except (anthropic.APIError, json.JSONDecodeError, KeyError, TypeError, ValueError):
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
                "domain": t.domain,
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
                "domain": t.domain,
                "urgency_score": t.urgency_score,
                "article_count": total_by_topic.get(rid, 0),
                f"articles_last_{tw}d": rn,
                f"articles_prior_{pw}d": pn,
                "trend": trend,
                "label": label,
                "note": note,
                "ai_enriched": ai_enriched,
            }
        )

    return results
