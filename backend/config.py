from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://pulse_user:pulse_password@localhost:5432/pulse_db"
    environment: str = "development"
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
    pinecone_environment: str = ""      # e.g. "us-east-1-aws"
    pinecone_index_name: str = "pulseone-articles"
    # Admin
    admin_password: str = "pulseadmin"

    model_config = {"env_file": ".env"}


settings = Settings()
