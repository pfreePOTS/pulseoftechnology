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
