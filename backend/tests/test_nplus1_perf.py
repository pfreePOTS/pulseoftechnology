"""Regression test: ``GET /api/admin/signals`` must not N+1 on `topic`.

The handler eagerly loads `SignalRecommendation.topic` with `joinedload`, so a
list of N signals should still issue a single SELECT against the bound engine.
We use the suite's `db_session` fixture (in-memory SQLite + StaticPool from
``conftest.py``) and the public route via `client` so the test exercises the
real dependency graph, not the handler in isolation.
"""

from __future__ import annotations

from sqlalchemy import event

from backend.models.signal import SignalRecommendation
from backend.models.topic import Topic


def _seed_signals(db_session, *, topics: int = 50, per_topic: int = 5) -> int:
    rows = 0
    for i in range(topics):
        topic = Topic(name=f"Perf Topic {i}", domain=f"Domain {i}")
        db_session.add(topic)
        db_session.flush()
        for _ in range(per_topic):
            db_session.add(
                SignalRecommendation(
                    topic_id=topic.id,
                    suggested_state="adopt",
                    suggested_action="watch",
                    rationale="Reason",
                    status="pending",
                )
            )
            rows += 1
    db_session.commit()
    return rows


def test_list_signals_does_not_n_plus_one(client, db_session):
    expected_rows = _seed_signals(db_session, topics=50, per_topic=5)

    engine = db_session.bind
    select_count = 0

    def _count_selects(_conn, _cursor, statement, *_a, **_kw) -> None:
        nonlocal select_count
        if statement.lstrip().upper().startswith("SELECT"):
            select_count += 1

    event.listen(engine, "before_cursor_execute", _count_selects)
    try:
        # Authenticate via the seeded admin user (see conftest.db_session).
        login = client.post(
            "/api/admin/login",
            json={"email": "pulseoneadmin@pulseone.local", "password": "pulseadmin"},
        )
        assert login.status_code == 200, login.text
        select_count = 0  # Reset so we only measure the /signals call.
        res = client.get("/api/admin/signals?status=pending")
    finally:
        event.remove(engine, "before_cursor_execute", _count_selects)

    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) == expected_rows
    # Two SELECTs: one for the admin user (auth) + one joined load for signals/topics.
    # Anything > 3 means the N+1 came back.
    assert select_count <= 3, f"Expected ≤3 SELECTs after auth, got {select_count}"
