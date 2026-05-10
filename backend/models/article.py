import enum
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class ArticleStatus(str, enum.Enum):
    raw = "raw"
    processed = "processed"
    published = "published"
    skipped = "skipped"  # gated as irrelevant or permanent failure — no retry
    retry = "retry"  # transient error (API, parse) — requeue by scheduler or manual job
    review = "review"  # low-confidence / questionable classification awaiting curator decision


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sources.id"), nullable=False, index=True
    )
    topic_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("topics.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False, index=True)
    # From RSS (media_thumbnail, enclosure, or first <img> in summary) — used in newsletter imagery
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    status: Mapped[ArticleStatus] = mapped_column(
        Enum(ArticleStatus), default=ArticleStatus.raw, nullable=False, index=True
    )
    what_is_it: Mapped[str | None] = mapped_column(Text, nullable=True)
    why_it_matters: Mapped[str | None] = mapped_column(Text, nullable=True)
    persona_impacts: Mapped[dict[str, str] | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # Classified subdomain at ingest time (must align with topic.subdomain when linked)
    subdomain: Mapped[str] = mapped_column(
        String(120), default="", server_default="", nullable=False
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    review_attempts: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )

    source: Mapped["Source"] = relationship("Source", back_populates="articles")
    topic: Mapped["Topic | None"] = relationship("Topic", back_populates="articles")

    def __repr__(self) -> str:
        return f"<Article id={self.id} title={self.title[:40]!r}>"
