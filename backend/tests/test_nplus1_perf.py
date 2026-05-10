import time
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.signal import SignalRecommendation
from backend.models.topic import Topic
from backend.routers.admin import list_signals

# Create in-memory SQLite database
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_list_signals_perf(db):
    # Setup test data
    topics = []
    for i in range(100):
        t = Topic(name=f"Topic {i}", domain=f"Domain {i}")
        db.add(t)
        topics.append(t)
    db.commit()

    for i in range(100):
        t = topics[i]
        for _ in range(5):
            sr = SignalRecommendation(
                topic_id=t.id,
                suggested_state="adopt",
                suggested_action="watch",
                rationale="Reason",
                status="pending",
            )
            db.add(sr)
    db.commit()

    # Track queries
    query_count = 0

    @event.listens_for(engine, "before_cursor_execute")
    def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        nonlocal query_count
        query_count += 1

    # Mock AdminUser
    mock_admin = MagicMock()

    # Measure time for list_signals
    start_time = time.time()
    result = list_signals(db=db, _=mock_admin, status="pending")
    end_time = time.time()

    elapsed = end_time - start_time
    print(f"\nElapsed time: {elapsed:.4f} seconds for {len(result)} records")
    print(f"Total SQL queries executed: {query_count}")

    # Should be 1 query with optimization
    assert query_count == 1
    assert len(result) == 500
