"""
Merged pipeline settings: Pydantic `Settings` (.env) overlaid with `SiteConfig` JSON row.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from ..config import settings as env_settings
from ..models.site_config import SiteConfig

CONFIG_ROW_ID = 1


@dataclass(frozen=True)
class MergedPipelineSettings:
    trend_window_days: int
    trend_prior_window_days: int
    article_retention_days: int
    article_archive_enabled: bool
    newsletter_article_lookback_days: int
    newsletter_send_hour_utc: int
    newsletter_send_minute_utc: int
    newsletter_enabled: bool
    last_newsletter_sent_at: datetime | None


def _coerce_int(val: Any, default: int) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _coerce_bool(val: Any, default: bool) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("1", "true", "yes", "on")
    return default


def _parse_iso_dt(val: Any) -> datetime | None:
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=UTC)
    if isinstance(val, str):
        try:
            s = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
        except ValueError:
            return None
    return None


def _defaults_from_env() -> dict[str, Any]:
    return {
        "trend_window_days": env_settings.trend_window_days,
        "trend_prior_window_days": env_settings.trend_prior_window_days,
        "article_retention_days": env_settings.article_retention_days,
        "article_archive_enabled": env_settings.article_archive_enabled,
        "newsletter_article_lookback_days": env_settings.newsletter_article_lookback_days,
        "newsletter_send_hour_utc": env_settings.newsletter_send_hour_utc,
        "newsletter_send_minute_utc": env_settings.newsletter_send_minute_utc,
        "newsletter_enabled": env_settings.newsletter_enabled,
        "last_newsletter_sent_at": None,
    }


def get_site_config_dict(db: Session) -> dict[str, Any]:
    row = db.query(SiteConfig).filter(SiteConfig.id == CONFIG_ROW_ID).first()
    if row is None or not row.config:
        return {}
    if not isinstance(row.config, dict):
        return {}
    return dict(row.config)


def merge_pipeline_settings(db: Session | None) -> MergedPipelineSettings:
    base = _defaults_from_env()
    if db is not None:
        overrides = get_site_config_dict(db)
        for k, v in overrides.items():
            if v is not None:
                base[k] = v

    tw = max(1, _coerce_int(base.get("trend_window_days"), env_settings.trend_window_days))
    tp = max(
        1, _coerce_int(base.get("trend_prior_window_days"), env_settings.trend_prior_window_days)
    )
    ar = max(
        1, _coerce_int(base.get("article_retention_days"), env_settings.article_retention_days)
    )
    nlb = max(
        1,
        _coerce_int(
            base.get("newsletter_article_lookback_days"),
            env_settings.newsletter_article_lookback_days,
        ),
    )
    h = max(
        0,
        min(
            23,
            _coerce_int(
                base.get("newsletter_send_hour_utc"), env_settings.newsletter_send_hour_utc
            ),
        ),
    )
    m = max(
        0,
        min(
            59,
            _coerce_int(
                base.get("newsletter_send_minute_utc"), env_settings.newsletter_send_minute_utc
            ),
        ),
    )

    last_dt = _parse_iso_dt(base.get("last_newsletter_sent_at"))

    return MergedPipelineSettings(
        trend_window_days=tw,
        trend_prior_window_days=tp,
        article_retention_days=ar,
        article_archive_enabled=_coerce_bool(
            base.get("article_archive_enabled"), env_settings.article_archive_enabled
        ),
        newsletter_article_lookback_days=nlb,
        newsletter_send_hour_utc=h,
        newsletter_send_minute_utc=m,
        newsletter_enabled=_coerce_bool(
            base.get("newsletter_enabled"), env_settings.newsletter_enabled
        ),
        last_newsletter_sent_at=last_dt,
    )


def set_last_newsletter_sent_at(db: Session, when: datetime | None = None) -> None:
    """Persist last newsletter send time into SiteConfig."""
    ts = when or datetime.now(UTC)
    row = db.query(SiteConfig).filter(SiteConfig.id == CONFIG_ROW_ID).first()
    cfg: dict[str, Any] = dict(row.config) if row and isinstance(row.config, dict) else {}
    cfg["last_newsletter_sent_at"] = ts.isoformat()
    if row is None:
        row = SiteConfig(id=CONFIG_ROW_ID, config=cfg, updated_at=ts)
        db.add(row)
    else:
        row.config = cfg
        row.updated_at = ts
    db.commit()


def merged_settings_public_dict(merged: MergedPipelineSettings) -> dict[str, Any]:
    """JSON-serializable dict for GET /api/admin/settings."""
    return {
        "trend_window_days": merged.trend_window_days,
        "trend_prior_window_days": merged.trend_prior_window_days,
        "article_retention_days": merged.article_retention_days,
        "article_archive_enabled": merged.article_archive_enabled,
        "newsletter_article_lookback_days": merged.newsletter_article_lookback_days,
        "newsletter_send_hour_utc": merged.newsletter_send_hour_utc,
        "newsletter_send_minute_utc": merged.newsletter_send_minute_utc,
        "newsletter_enabled": merged.newsletter_enabled,
        "last_newsletter_sent_at": merged.last_newsletter_sent_at.isoformat()
        if merged.last_newsletter_sent_at
        else None,
    }


def upsert_site_config(db: Session, updates: dict[str, Any]) -> dict[str, Any]:
    """Merge updates into SiteConfig JSON and return the merged dict (not yet combined with env)."""
    row = db.query(SiteConfig).filter(SiteConfig.id == CONFIG_ROW_ID).first()
    cfg: dict[str, Any] = dict(row.config) if row and isinstance(row.config, dict) else {}
    for k, v in updates.items():
        if v is None:
            cfg.pop(k, None)
        else:
            cfg[k] = v
    now = datetime.now(UTC)
    if row is None:
        row = SiteConfig(id=CONFIG_ROW_ID, config=cfg, updated_at=now)
        db.add(row)
    else:
        row.config = cfg
        row.updated_at = now
    db.commit()
    db.refresh(row)
    return dict(row.config) if isinstance(row.config, dict) else {}
