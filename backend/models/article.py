import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class ArticleStatus(str, enum.Enum):
    raw = "raw"
    processed = "processed"
    published = "published"


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id"), nullable=False, index=True)
    topic_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("topics.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False, index=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    status: Mapped[ArticleStatus] = mapped_column(
        Enum(ArticleStatus), default=ArticleStatus.raw, nullable=False, index=True
    )
    what_is_it: Mapped[str | None] = mapped_column(Text, nullable=True)
    why_it_matters: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    source: Mapped["Source"] = relationship("Source", back_populates="articles")
    topic: Mapped["Topic | None"] = relationship("Topic", back_populates="articles")

    def __repr__(self) -> str:
        return f"<Article id={self.id} title={self.title[:40]!r}>"
