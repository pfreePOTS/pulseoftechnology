import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscriber_email: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    score: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # 1=not relevant, 2=somewhat, 3=highly
    newsletter_date: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "2026-04-01"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
