import logging
import re
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load repo-root `.env` first, then `backend/.env` (later file wins on duplicate keys).
# This avoids depending on process CWD (pytest/uvicorn from `backend/` could miss pulseoftechnology/.env).
_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT_DIR = _BACKEND_DIR.parent

logger = logging.getLogger(__name__)


def _normalize_mistaken_pulse_db_role(url: str) -> str:
    """Map mistaken Postgres user ``pulse`` → ``pulse_user`` (Compose / project default).

    A common bad DSN is ``postgresql://pulse:...@host/pulse_db`` (project name confused
    with the DB role). PostgreSQL then errors: ``role "pulse" does not exist``.
    """
    if not url.strip():
        return url
    out = re.sub(
        r"^(postgresql(?:\+[^:]+)?://)pulse([:@])",
        r"\1pulse_user\2",
        url,
        count=1,
    )
    if out != url:
        logger.warning(
            "DATABASE_URL used PostgreSQL role 'pulse'; coerced to 'pulse_user'. "
            "Set POSTGRES_USER=pulse_user or fix DATABASE_URL (see README)."
        )
    return out


def _discovered_env_files() -> tuple[Path, ...]:
    paths: list[Path] = []
    for p in (_REPO_ROOT_DIR / ".env", _BACKEND_DIR / ".env"):
        if p.is_file():
            paths.append(p)
    return tuple(paths)


class Settings(BaseSettings):
    database_url: str = "postgresql://pulse_user:pulse_password@localhost:5432/pulse_db"
    environment: str = "development"
    # Comma-separated browser origins for CORS (required when using credentials)
    cors_origins: str = "http://localhost:3000,http://localhost:3100"
    # HS256 signing key for admin JWTs — override in production
    admin_jwt_secret: str = "dev-only-set-ADMIN-JWT-SECRET-in-production"
    admin_token_expire_minutes: int = 60 * 24  # 24 hours
    # Separate HS256 key for subscriber preference/unsubscribe magic links.
    subscriber_token_secret: str = "dev-only-set-SUBSCRIBER_TOKEN_SECRET-in-production"
    # DeepSeek (OpenAI-compatible)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"
    # Anthropic Claude — optional fallback when DeepSeek fails or when only this key is set
    anthropic_api_key: str = ""
    anthropic_haiku_model: str = "claude-haiku-4-5-20251001"
    anthropic_sonnet_model: str = "claude-sonnet-4-6"
    # SendGrid
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "radar@pulseone.com"
    sendgrid_from_name: str = "PulseOne Radar"
    sendgrid_newsletter_template_id: str = ""  # legacy; newsletter always sends built-in full HTML
    # Public API base URL for newsletter links (survey, read online); no trailing slash
    api_base_url: str = "http://localhost:8000"
    # Public Next.js site (radar home) for “dig deeper” links; no trailing slash
    public_site_url: str = "http://localhost:3100"
    # Full URL to logo image for email (<img src>). If empty, built-in HTML uses a text wordmark only.
    # Use a public HTTPS URL in production — localhost images do not load in most email clients.
    newsletter_logo_url: str = ""
    # HubSpot CRM (optional PAT)
    hubspot_api_key: str = ""
    hubspot_batch_sync_enabled: bool = True
    hubspot_batch_sync_hour_utc: int = Field(default=4, ge=0, le=23)
    hubspot_batch_sync_minute_utc: int = Field(default=0, ge=0, le=59)
    # ILS list ID (HubSpot UI: list details) — MANUAL or SNAPSHOT list only; used after contact upsert
    hubspot_newsletter_list_id: str = ""
    # Pinecone vector database (optional — signal scorer degrades gracefully without it)
    pinecone_api_key: str = ""
    pinecone_environment: str = ""  # e.g. "us-east-1-aws"
    pinecone_index_name: str = "pulseone-articles"
    # Admin — use ADMIN_PASSWORD_HASH (bcrypt) in production; else ADMIN_PASSWORD (plain) for dev only
    admin_password: str = "pulseadmin"
    admin_password_hash: str = ""
    # Bootstrap superuser when admin_users is empty (docker / first deploy). Also used as login email.
    first_admin_email: str = "pulseoneadmin@pulseone.local"

    # Trend analysis (SQL windows + positioning insights)
    trend_window_days: int = Field(default=7, ge=1, le=120)
    trend_prior_window_days: int = Field(default=7, ge=1, le=120)

    # Article retention / archiving
    article_retention_days: int = Field(default=30, ge=1, le=3650)
    article_archive_enabled: bool = True
    # Max raw+retry articles evaluated per pipeline invocation (hourly job + manual
    # "Process raw"). Without a cap, a large backlog can hold the worker for tens of
    # minutes and makes the admin UI look frozen; remaining rows are picked up on
    # subsequent ticks or "Process raw" clicks.
    article_pipeline_max_per_pass: int = Field(default=80, ge=1, le=2000)

    # Newsletter — ingest windows for daily briefing (narrow → wider fallback chains)
    # Top rollup + topic-rank peaks: prioritize very fresh ingests (hours).
    newsletter_top_ingest_hours: int = Field(default=24, ge=1, le=168)
    # Deep-dive supporting articles: allow ~2–3 day window before legacy fill.
    newsletter_deep_dive_ingest_hours: int = Field(default=72, ge=1, le=336)
    # Widest fallback only when tighter pools are empty for a topic (typically a few days).
    newsletter_article_lookback_days: int = Field(default=4, ge=1, le=365)
    newsletter_send_hour_utc: int = Field(default=7, ge=0, le=23)
    newsletter_send_minute_utc: int = Field(default=0, ge=0, le=59)
    newsletter_enabled: bool = True
    # Pause between SendGrid sends in run_daily_newsletter (0 = no delay)
    newsletter_subscriber_delay_seconds: float = Field(default=0.1, ge=0.0, le=60.0)

    @field_validator("database_url", mode="before")
    @classmethod
    def database_url_fix_mistaken_pulse_role(cls, v: object) -> object:
        """Avoid FATAL: role \"pulse\" does not exist when DSN matches ``pulse`` not ``pulse_user``."""
        if v is None or not isinstance(v, str):
            return v
        return _normalize_mistaken_pulse_db_role(v.strip())

    @field_validator("sendgrid_newsletter_template_id", mode="before")
    @classmethod
    def empty_sendgrid_template_if_comment_like(cls, v: object) -> str:
        """Some .env loaders pass inline '# ...' as the value; treat as no template (built-in HTML)."""
        if v is None:
            return ""
        s = str(v).strip()
        if not s or s.startswith("#"):
            return ""
        return s

    @model_validator(mode="after")
    def reject_unsafe_production_defaults(self) -> "Settings":
        """Fail closed when production/staging still uses local-dev secrets."""
        if self.environment.strip().lower() not in {"production", "staging"}:
            return self

        errors: list[str] = []
        unsafe_admin_jwt = {
            "",
            "change-me-to-a-long-random-secret",
            "dev-only-set-ADMIN_JWT_SECRET-in-production",
            "dev-only-set-ADMIN-JWT-SECRET-in-production",
        }
        unsafe_subscriber = {
            "",
            "change-me-to-a-long-random-secret",
            "dev-only-set-SUBSCRIBER_TOKEN_SECRET-in-production",
        }
        if self.admin_jwt_secret in unsafe_admin_jwt or len(self.admin_jwt_secret) < 32:
            errors.append(
                "ADMIN_JWT_SECRET must be a non-default random value of at least 32 chars"
            )
        if (
            self.subscriber_token_secret in unsafe_subscriber
            or len(self.subscriber_token_secret) < 32
        ):
            errors.append(
                "SUBSCRIBER_TOKEN_SECRET must be a non-default random value of at least 32 chars"
            )
        if self.subscriber_token_secret == self.admin_jwt_secret:
            errors.append("SUBSCRIBER_TOKEN_SECRET must differ from ADMIN_JWT_SECRET")
        if not self.admin_password_hash and self.admin_password in {"", "pulseadmin"}:
            errors.append("ADMIN_PASSWORD_HASH or a non-default ADMIN_PASSWORD is required")
        if errors:
            raise ValueError("; ".join(errors))
        return self

    model_config = SettingsConfigDict(
        env_file=_discovered_env_files() or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
