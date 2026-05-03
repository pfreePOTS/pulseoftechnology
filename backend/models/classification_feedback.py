from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ClassificationFeedback(Base):
    """Curator corrections used as examples for future article classification."""

    __tablename__ = "classification_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    article_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("articles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    article_title: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_domain: Mapped[str | None] = mapped_column(String(100), nullable=True)
    original_subdomain: Mapped[str | None] = mapped_column(String(120), nullable=True)
    original_topic_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    corrected_domain: Mapped[str | None] = mapped_column(String(100), nullable=True)
    corrected_subdomain: Mapped[str | None] = mapped_column(String(120), nullable=True)
    corrected_topic_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
