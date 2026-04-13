import logging
from datetime import UTC, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .database import SessionLocal
from .services.email_service import run_daily_newsletter
from .services.ingestion import run_all_sources

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _ingestion_job() -> None:
    """Scheduled job: open a DB session, ingest all active sources, then score signals."""
    from .services.signal_service import (
        backfill_missing_trend_suggestions,
        cleanup_empty_topics,
        refresh_all_signals,
        run_signal_scorer,
    )

    db = SessionLocal()
    try:
        run_all_sources(db)
        try:
            cleanup_empty_topics(db)
            run_signal_scorer(db)
            refresh_all_signals(db)
        except Exception:
            logger.exception("Signal scorer/refresh after ingestion failed")
        try:
            n = backfill_missing_trend_suggestions(db, limit=20)
            if n:
                logger.info("After ingestion: trend suggestion backfill for %d topic(s)", n)
        except Exception:
            logger.exception("Trend suggestion backfill after ingestion failed")
    except Exception:
        logger.exception("Unhandled error in ingestion job")
    finally:
        db.close()


def _newsletter_job() -> None:
    """Scheduled job: assemble and dispatch the daily newsletter."""
    db = SessionLocal()
    try:
        run_daily_newsletter(db)
    except Exception:
        logger.exception("Unhandled error in newsletter job")
    finally:
        db.close()


def _archive_job() -> None:
    """Daily soft-archive of articles past retention (05:00 UTC)."""
    from .services.archive_service import archive_old_articles

    db = SessionLocal()
    try:
        n = archive_old_articles(db)
        if n:
            logger.info("Article archive job: archived %d row(s)", n)
    except Exception:
        logger.exception("Unhandled error in article archive job")
    finally:
        db.close()


def _signal_job() -> None:
    """Scheduled job: cleanup, score high-velocity topics, refresh radar, backfill the rest."""
    from .services.signal_service import (
        backfill_missing_trend_suggestions,
        cleanup_empty_topics,
        refresh_all_signals,
        run_signal_scorer,
    )

    db = SessionLocal()
    try:
        cleanup_empty_topics(db)
        run_signal_scorer(db)
        try:
            refresh_all_signals(db)
        except Exception:
            logger.exception("refresh_all_signals failed in signal job")
        try:
            n = backfill_missing_trend_suggestions(db, limit=50)
            if n:
                logger.info("After signal scorer: trend suggestion backfill for %d topic(s)", n)
        except Exception:
            logger.exception("Trend suggestion backfill after signal job failed")
    except Exception:
        logger.exception("Unhandled error in signal scorer job")
    finally:
        db.close()


def schedule_newsletter_job() -> None:
    """(Re)schedule the newsletter cron from merged DB/env settings."""
    from .services.pipeline_settings import merge_pipeline_settings

    db = SessionLocal()
    try:
        m = merge_pipeline_settings(db)
        scheduler.add_job(
            _newsletter_job,
            trigger=CronTrigger(
                hour=m.newsletter_send_hour_utc,
                minute=m.newsletter_send_minute_utc,
                timezone="UTC",
            ),
            id="daily_newsletter",
            replace_existing=True,
        )
        logger.info(
            "Newsletter job scheduled — %02d:%02d UTC",
            m.newsletter_send_hour_utc,
            m.newsletter_send_minute_utc,
        )
    finally:
        db.close()


def start_scheduler() -> None:
    # Run ingestion soon after API boot, then every hour (otherwise first run could be ~1h later).
    scheduler.add_job(
        _ingestion_job,
        trigger="interval",
        hours=1,
        id="rss_ingestion",
        replace_existing=True,
        next_run_time=datetime.now(UTC),
    )
    scheduler.add_job(
        _archive_job,
        trigger=CronTrigger(hour=5, minute=0, timezone="UTC"),
        id="article_archiver",
        replace_existing=True,
    )
    scheduler.add_job(
        _signal_job,
        trigger=CronTrigger(hour=6, minute=0, timezone="UTC"),
        id="signal_scorer",
        replace_existing=True,
    )
    schedule_newsletter_job()
    scheduler.start()
    logger.info(
        "Scheduler started — ingestion hourly · archive 05:00 UTC · signals 06:00 UTC · newsletter from settings"
    )


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
