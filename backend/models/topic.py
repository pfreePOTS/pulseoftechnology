import enum

from sqlalchemy import Enum, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class TopicStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    domain: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., AI, Security, Cloud
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    urgency_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[TopicStatus] = mapped_column(
        Enum(TopicStatus), default=TopicStatus.pending, nullable=False, index=True
    )

    articles: Mapped[list["Article"]] = relationship("Article", back_populates="topic")

    def __repr__(self) -> str:
        return f"<Topic id={self.id} name={self.name!r} domain={self.domain!r} status={self.status!r}>"
