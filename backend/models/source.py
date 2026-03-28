import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class SourceType(str, enum.Enum):
    rss = "rss"
    api = "api"


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False)
    type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False, default=SourceType.rss)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    articles: Mapped[list["Article"]] = relationship("Article", back_populates="source")

    def __repr__(self) -> str:
        return f"<Source id={self.id} name={self.name!r}>"
