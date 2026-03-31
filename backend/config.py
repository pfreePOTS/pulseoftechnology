from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://pulse_user:pulse_password@localhost:5432/pulse_db"
    environment: str = "development"
    # Comma-separated browser origins for CORS (required when using credentials)
    cors_origins: str = "http://localhost:3000,http://localhost:3100"
    # HS256 signing key for admin JWTs — override in production
    admin_jwt_secret: str = "dev-only-set-ADMIN_JWT_SECRET-in-production"
    admin_token_expire_minutes: int = 60 * 24  # 24 hours
    anthropic_api_key: str = ""
    # SendGrid
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "radar@pulseone.com"
    sendgrid_from_name: str = "PulseOne Radar"
    sendgrid_newsletter_template_id: str = ""  # optional dynamic template
    # HubSpot
    hubspot_api_key: str = ""  # private app access token
    # Pinecone vector database (optional — signal scorer degrades gracefully without it)
    pinecone_api_key: str = ""
    pinecone_environment: str = ""  # e.g. "us-east-1-aws"
    pinecone_index_name: str = "pulseone-articles"
    # Admin — use ADMIN_PASSWORD_HASH (bcrypt) in production; else ADMIN_PASSWORD (plain) for dev only
    admin_password: str = "pulseadmin"
    admin_password_hash: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
