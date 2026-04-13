"""Tests for `signal_service.execute_full_signal_flow` orchestration."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from backend.services.signal_service import execute_full_signal_flow


def test_execute_full_signal_flow_calls_steps_in_order():
    db = MagicMock()
    order: list[str] = []

    def track(name: str):
        def _inner(*args, **kwargs):
            order.append(name)
            return 0

        return _inner

    with (
        patch(
            "backend.services.signal_service.cleanup_empty_topics",
            side_effect=track("cleanup"),
        ) as m_cleanup,
        patch(
            "backend.services.signal_service.run_signal_scorer",
            side_effect=track("scorer"),
        ) as m_scorer,
        patch(
            "backend.services.signal_service.refresh_all_signals",
            side_effect=track("refresh"),
        ) as m_refresh,
        patch(
            "backend.services.signal_service.backfill_missing_trend_suggestions",
            side_effect=track("backfill"),
        ) as m_backfill,
    ):
        execute_full_signal_flow(db)

    assert order == ["cleanup", "scorer", "refresh", "backfill"]
    m_cleanup.assert_called_once_with(db)
    m_scorer.assert_called_once_with(db)
    m_refresh.assert_called_once_with(db)
    m_backfill.assert_called_once_with(db, limit=50)


def test_execute_full_signal_flow_passes_backfill_limit():
    db = MagicMock()

    with (
        patch(
            "backend.services.signal_service.cleanup_empty_topics",
            return_value=0,
        ),
        patch(
            "backend.services.signal_service.run_signal_scorer",
            return_value=0,
        ),
        patch(
            "backend.services.signal_service.refresh_all_signals",
            return_value=0,
        ),
        patch(
            "backend.services.signal_service.backfill_missing_trend_suggestions",
            return_value=0,
        ) as m_backfill,
    ):
        execute_full_signal_flow(db, backfill_limit=17)

    m_backfill.assert_called_once_with(db, limit=17)
