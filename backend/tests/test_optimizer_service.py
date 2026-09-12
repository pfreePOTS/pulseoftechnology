"""Tests for optimizer_service (analyze + pending gate)."""

from datetime import UTC, datetime, timedelta

from backend.models.agent_run import AgentRun
from backend.models.prompt import PromptProposal
from backend.services import optimizer_service


def test_analyze_agent_performance_returns_worst_agent(db_session):
    db = db_session
    now = datetime.now(UTC)
    db.add_all(
        [
            AgentRun(
                agent_name="classify",
                is_success=False,
                fallback_used=True,
                created_at=now - timedelta(days=1),
            ),
            AgentRun(
                agent_name="classify",
                is_success=False,
                fallback_used=False,
                created_at=now - timedelta(days=1),
            ),
            AgentRun(
                agent_name="gate",
                is_success=True,
                fallback_used=True,
                created_at=now - timedelta(days=1),
            ),
            AgentRun(
                agent_name="score",
                is_success=False,
                fallback_used=False,
                created_at=now - timedelta(days=1),
            ),
        ]
    )
    db.commit()

    worst = optimizer_service.analyze_agent_performance(db, days=7)
    assert worst == "classify"


def test_analyze_agent_performance_empty(db_session):
    assert optimizer_service.analyze_agent_performance(db_session, days=7) is None


def test_run_daily_skips_when_pending_proposal(db_session, monkeypatch):
    db = db_session
    db.add(
        PromptProposal(
            agent_name="gate",
            base_version="1.0.0",
            proposed_system_prompt="x",
            rationale="",
            test_improvement_score=None,
            status="pending",
        )
    )
    db.commit()

    called = {"n": 0}

    def boom(*_a, **_k):
        called["n"] += 1

    monkeypatch.setattr(optimizer_service, "analyze_agent_performance", boom)
    monkeypatch.setattr(optimizer_service, "generate_prompt_improvement", boom)

    # run_daily_prompt_optimizer_job uses SessionLocal(); bind it to the test SQLite session.
    class _SessionFactory:
        def __call__(self):
            return db

    monkeypatch.setattr(optimizer_service, "SessionLocal", _SessionFactory())

    optimizer_service.run_daily_prompt_optimizer_job()
    assert called["n"] == 0


def test_run_daily_expires_stale_pending_then_continues(db_session, monkeypatch):
    db = db_session
    stale = PromptProposal(
        agent_name="summarize_node_legacy",
        base_version="1.0.0",
        proposed_system_prompt="old",
        rationale="",
        test_improvement_score=None,
        status="pending",
        created_at=datetime.now(UTC) - timedelta(days=15),
    )
    db.add(stale)
    db.commit()
    stale_id = stale.id

    analyzed = {"n": 0}

    def _analyze(*_a, **_k):
        analyzed["n"] += 1
        return None

    monkeypatch.setattr(optimizer_service, "analyze_agent_performance", _analyze)
    monkeypatch.setattr(optimizer_service, "generate_prompt_improvement", lambda *_a, **_k: None)

    class _SessionFactory:
        def __call__(self):
            return db

    monkeypatch.setattr(optimizer_service, "SessionLocal", _SessionFactory())

    optimizer_service.run_daily_prompt_optimizer_job()
    expired = db.query(PromptProposal).filter(PromptProposal.id == stale_id).one()
    assert expired.status == "rejected"
    assert "Expired unused after 14 days" in (expired.rationale or "")
    assert analyzed["n"] == 1


def test_run_daily_still_skips_fresh_pending_after_expiring_stale(db_session, monkeypatch):
    db = db_session
    db.add_all(
        [
            PromptProposal(
                agent_name="summarize_node_legacy",
                base_version="1.0.0",
                proposed_system_prompt="old",
                rationale="",
                test_improvement_score=None,
                status="pending",
                created_at=datetime.now(UTC) - timedelta(days=15),
            ),
            PromptProposal(
                agent_name="gate",
                base_version="1.0.0",
                proposed_system_prompt="new",
                rationale="",
                test_improvement_score=None,
                status="pending",
                created_at=datetime.now(UTC) - timedelta(days=2),
            ),
        ]
    )
    db.commit()

    called = {"n": 0}

    def boom(*_a, **_k):
        called["n"] += 1

    monkeypatch.setattr(optimizer_service, "analyze_agent_performance", boom)
    monkeypatch.setattr(optimizer_service, "generate_prompt_improvement", boom)

    class _SessionFactory:
        def __call__(self):
            return db

    monkeypatch.setattr(optimizer_service, "SessionLocal", _SessionFactory())

    optimizer_service.run_daily_prompt_optimizer_job()
    assert called["n"] == 0
    stale = (
        db.query(PromptProposal).filter(PromptProposal.agent_name == "summarize_node_legacy").one()
    )
    fresh = db.query(PromptProposal).filter(PromptProposal.agent_name == "gate").one()
    assert stale.status == "rejected"
    assert fresh.status == "pending"
