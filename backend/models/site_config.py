"""Singleton site configuration stored in the database (overrides .env defaults)."""

from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class SiteConfig(Base):
    """
    Single-row table (id=1) holding JSON overrides for pipeline/newsletter settings.
    """

    __tablename__ = "site_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<SiteConfig id={self.id}>"
