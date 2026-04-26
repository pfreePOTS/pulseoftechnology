from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://pulse_user:pulse_password@localhost:5432/pulse_db"
    environment: str = "development"
    # Comma-separated browser origins for CORS (required when using credentials)
    cors_origins: str = "http://localhost:3000,http://localhost:3100"
    # HS256 signing key for admin JWTs — override in production
    admin_jwt_secret: str = "dev-only-set-ADMIN-JWT-SECRET-in-production"
    admin_token_expire_minutes: int = 60 * 24  # 24 hours
    anthropic_api_key: str = ""
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
    # HubSpot
    hubspot_api_key: str = ""  # private app access token
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

    # Newsletter
    newsletter_article_lookback_days: int = Field(default=7, ge=1, le=365)
    newsletter_send_hour_utc: int = Field(default=7, ge=0, le=23)
    newsletter_send_minute_utc: int = Field(default=0, ge=0, le=59)
    newsletter_enabled: bool = True
    # Pause between SendGrid sends in run_daily_newsletter (0 = no delay)
    newsletter_subscriber_delay_seconds: float = Field(default=0.1, ge=0.0, le=60.0)

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

    model_config = {"env_file": ".env"}


settings = Settings()
