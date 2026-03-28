import logging

from apscheduler.schedulers.background import BackgroundScheduler

from .database import SessionLocal
from .services.email_service import run_daily_newsletter
from .services.ingestion import run_all_sources

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _ingestion_job() -> None:
    """Scheduled job: open a DB session and ingest all active sources."""
    db = SessionLocal()
    try:
        run_all_sources(db)
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


def start_scheduler() -> None:
    scheduler.add_job(
        _ingestion_job,
        trigger="interval",
        hours=1,
        id="rss_ingestion",
        replace_existing=True,
    )
    scheduler.add_job(
        _newsletter_job,
        trigger="cron",
        hour=7,        # 07:00 UTC daily
        minute=0,
        id="daily_newsletter",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — RSS ingestion every hour, newsletter daily at 07:00 UTC")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
