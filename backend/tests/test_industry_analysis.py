"""PULSE-039/040/041: placeholder industry cells, automatic first-pass analysis, seed safety."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from backend.config import settings
from backend.models.article import Article, ArticleStatus
from backend.models.source import Source, SourceType
from backend.models.topic import AdoptionState, Topic, TopicStatus
from backend.services import ai_service, email_service
from backend.services.ai_service import INDUSTRY_GRID_LABELS, fill_missing_industry_grid_rows
from backend.tests.domain_fixtures import make_topic

AI_ROW = {
    "impact_score": 8.5,
    "risk_level": 7.0,
    "adoption_state": "Get Prepared For",
    "industry_impact": "Plants run unpatched controllers on flat networks.",
    "scoring_rationale": "High exposure.",
    "phase_rationale": "Programs are funded.",
    "remediation": "Segment OT networks.",
    "source": "ai",
    "impact_approved": True,
}


def _login(client) -> None:
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )


def _source(db) -> Source:
    src = db.query(Source).first()
    if src is None:
        src = Source(name="Test", url="https://example.com/rss", type=SourceType.rss)
        db.add(src)
        db.flush()
    return src


def _article(db, topic_id: int, title: str, published_at: datetime) -> Article:
    a = Article(
        source_id=_source(db).id,
        topic_id=topic_id,
        title=title,
        url=f"https://example.com/{topic_id}/{title.replace(' ', '-')}",
        content=f"Body of {title}",
        published_at=published_at,
        ingested_at=published_at,
        status=ArticleStatus.processed,
    )
    db.add(a)
    db.flush()
    return a


def _selected_topic(db, name: str = "OT security", **kw) -> Topic:
    defaults = dict(
        status=TopicStatus.selected,
        urgency_score=10.0,
        adoption_state=AdoptionState.learn_about,
        selected_at=datetime.now(UTC),
    )
    return make_topic(db, name=name, domain_slug="security", **{**defaults, **kw})


def _grid_with(topic: Topic, rows: dict) -> dict:
    return fill_missing_industry_grid_rows(topic, rows)


def _fake_llm_response(system: str) -> str:
    """Answer exactly the industries the batch prompt asks for."""
    keys = [k for k in INDUSTRY_GRID_LABELS if f'"{k}"' in system]
    body = {k: {**AI_ROW, "industry_impact": f"{k} specific impact."} for k in keys}
    for k in body:
        body[k].pop("source")
        body[k].pop("impact_approved")
    return json.dumps({"industry_suggestions": body})


def _fake_call_result(model, system, user, max_tokens, **kw):
    return SimpleNamespace(
        text=_fake_llm_response(system), latency_ms=1, total_tokens=1, model_id=model
    )


# ── Placeholder backfill (PULSE-039) ─────────────────────────────────────────


def test_backfill_cells_are_placeholders_off_the_radar(db_session):
    topic = _selected_topic(db_session)
    grid = _grid_with(topic, {"Technology": dict(AI_ROW)})
    assert grid["Technology"]["impact_approved"] is True
    assert grid["Healthcare"]["source"] == "placeholder"
    assert grid["Healthcare"]["impact_approved"] is False


def test_public_topics_hide_placeholder_cells(client, db_session):
    topic = _selected_topic(db_session, is_published=True)
    _article(db_session, topic.id, "Live story", datetime.now(UTC))
    grid = _grid_with(topic, {"Technology": dict(AI_ROW)})
    # Legacy backfill (written before cells carried a source) must be hidden too.
    grid["Energy"] = {k: v for k, v in grid["Energy"].items() if k != "source"}
    grid["Energy"]["impact_approved"] = True
    topic.industry_positions = grid
    db_session.commit()

    r = client.get("/api/topics/published")
    assert r.status_code == 200
    row = next(t for t in r.json() if t["id"] == topic.id)
    assert list(row["industry_positions"].keys()) == ["Technology"]
    assert "Placeholder" not in json.dumps(row)


def test_newsletter_ignores_placeholder_cells(db_session):
    topic = _selected_topic(db_session)
    topic.industry_positions = _grid_with(topic, {})
    sub = SimpleNamespace(industries=["Healthcare"])
    assert email_service._subscriber_industry_teaser(topic, sub) == ""
    assert email_service._subscriber_remediation_teaser(topic, sub) == ""
    assert not email_service._topic_has_industry_grid_hit(topic, ["Healthcare"])

    topic.industry_positions = _grid_with(topic, {"Healthcare": dict(AI_ROW)})
    assert "unpatched controllers" in email_service._subscriber_industry_teaser(topic, sub)


def test_curator_edit_marks_cell_manual(client, db_session):
    topic = _selected_topic(db_session)
    topic.industry_positions = _grid_with(
        topic, {"Technology": dict(AI_ROW), "Healthcare": dict(AI_ROW)}
    )
    db_session.commit()
    sent = json.loads(json.dumps(topic.industry_positions))
    sent["Healthcare"]["impact_score"] = 3.0
    sent["Energy"]["risk_level"] = 9.0

    _login(client)
    r = client.put(f"/api/admin/topics/{topic.id}", json={"industry_positions": sent})
    assert r.status_code == 200
    ip = r.json()["industry_positions"]
    assert ip["Healthcare"]["source"] == "manual"
    assert ip["Technology"]["source"] == "ai"
    assert ip["Retail"]["source"] == "placeholder"
    assert ip["Energy"]["source"] == "manual"
    assert "industry_impact" not in ip["Energy"]


# ── Suggest + automatic runs (PULSE-040) ─────────────────────────────────────


def test_suggest_reads_newest_articles_and_marks_ai(db_session, caplog):
    topic = _selected_topic(db_session)
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for day in range(10):
        _article(db_session, topic.id, f"story day {day}", base + timedelta(days=day))
    db_session.commit()

    seen_users: list[str] = []

    def fake(model, system, user, max_tokens, **kw):
        seen_users.append(user)
        return _fake_call_result(model, system, user, max_tokens, **kw)

    with (
        patch.object(ai_service, "_call_result", side_effect=fake),
        caplog.at_level(logging.WARNING, logger="backend.services.ai_service"),
    ):
        out = ai_service.suggest_industry_positions(topic.id, db_session)

    assert len(seen_users) == 2
    assert "story day 9" in seen_users[0]
    assert "story day 0" not in seen_users[0]
    sug = out["industry_suggestions"]
    assert {r["source"] for r in sug.values()} == {"ai"}
    assert "omitted" not in caplog.text


def test_analyze_keeps_manual_cells_and_records_success(db_session):
    from backend.services.industry_analysis import analyze_topic_industries

    topic = _selected_topic(db_session)
    manual = {**AI_ROW, "source": "manual", "industry_impact": "Curator wrote this."}
    unchecked = {**AI_ROW, "impact_approved": False}
    topic.industry_positions = _grid_with(topic, {"Healthcare": manual, "Technology": unchecked})
    topic.industry_analysis_attempts = 2
    db_session.commit()

    with patch.object(ai_service, "_call_result", side_effect=_fake_call_result):
        assert analyze_topic_industries(topic.id, db_session) is True

    db_session.refresh(topic)
    ip = topic.industry_positions
    assert ip["Healthcare"]["industry_impact"] == "Curator wrote this."
    assert ip["Retail"]["source"] == "ai"
    assert ip["Retail"]["impact_approved"] is True
    assert ip["Technology"]["impact_approved"] is False
    assert topic.industry_analyzed_at is not None
    assert topic.industry_analysis_attempts == 0
    assert topic.industry_analysis_started_at is None


def test_analyze_failure_counts_attempt(db_session):
    from backend.services.industry_analysis import analyze_topic_industries

    topic = _selected_topic(db_session)
    topic.industry_positions = _grid_with(topic, {})
    db_session.commit()

    with patch.object(ai_service, "_call_result", side_effect=RuntimeError("provider down")):
        assert analyze_topic_industries(topic.id, db_session) is False

    db_session.refresh(topic)
    assert topic.industry_analysis_attempts == 1
    assert "provider down" in (topic.industry_analysis_error or "")
    assert topic.industry_analysis_started_at is None
    assert topic.industry_positions["Retail"]["source"] == "placeholder"


def test_analyze_skips_topic_claimed_by_another_run(db_session):
    from backend.services.industry_analysis import analyze_topic_industries

    topic = _selected_topic(db_session)
    topic.industry_positions = _grid_with(topic, {})
    topic.industry_analysis_started_at = datetime.now(UTC)
    db_session.commit()

    with patch.object(ai_service, "_call_result") as call:
        assert analyze_topic_industries(topic.id, db_session) is False
    call.assert_not_called()


def test_sweep_picks_pending_topics_oldest_first(db_session):
    from backend.services.industry_analysis import topics_due_for_industry_analysis

    now = datetime.now(UTC)

    def topic(name, **kw):
        t = _selected_topic(db_session, name=name, **kw)
        t.industry_positions = _grid_with(t, {})
        return t

    newer = topic("newer", selected_at=now - timedelta(days=1))
    older = topic("older", selected_at=now - timedelta(days=9))
    topic("gave up", industry_analysis_attempts=3)
    topic("running", industry_analysis_started_at=now)
    topic("watched only", status=TopicStatus.watched)
    done = _selected_topic(db_session, name="done")
    done.industry_positions = {k: dict(AI_ROW) for k in INDUSTRY_GRID_LABELS}
    db_session.commit()

    due = topics_due_for_industry_analysis(db_session, now=now)
    assert [t.id for t in due] == [older.id, newer.id]


def test_approve_queues_first_pass_analysis(client, db_session):
    topic = make_topic(
        db_session,
        name="New candidate",
        domain_slug="security",
        status=TopicStatus.watched,
        urgency_score=6.0,
        industry_analysis_attempts=3,
    )
    db_session.commit()
    _login(client)
    with (
        patch("backend.routers.admin.is_llm_configured", return_value=True),
        patch("backend.routers.admin._spawn_long_admin_job") as spawn,
    ):
        r = client.post(f"/api/admin/topics/{topic.id}/approve")
    assert r.status_code == 200
    spawn.assert_called_once()
    body = r.json()
    assert body["industry_analysis_attempts"] == 0
    assert body["industry_positions"]["Healthcare"]["impact_approved"] is False


# ── Seed safety (PULSE-041) ──────────────────────────────────────────────────


@pytest.fixture
def seed_into(db_session):
    from backend import seed_topics

    db_session.close = lambda: None  # type: ignore[method-assign]
    with (
        patch.object(seed_topics, "SessionLocal", return_value=db_session),
        patch("backend.seed_domains.seed"),
    ):
        yield seed_topics.seed


def test_seed_keeps_existing_analysis_and_publish_state(db_session, seed_into):
    topic = make_topic(
        db_session,
        name="Object storage and data sovereignty",
        domain_slug="storage",
        status=TopicStatus.selected,
        urgency_score=4.0,
        is_published=False,
    )
    topic.industry_positions = {"Energy": dict(AI_ROW)}
    db_session.commit()

    seed_into()

    db_session.refresh(topic)
    assert topic.industry_positions["Energy"]["industry_impact"] == AI_ROW["industry_impact"]
    assert topic.industry_positions["Retail"]["source"] == "placeholder"
    assert topic.is_published is False
    assert topic.urgency_score == 4.0
