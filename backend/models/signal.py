from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class SignalRecommendation(Base):
    __tablename__ = "signal_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    topic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    suggested_state: Mapped[str] = mapped_column(String(100), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    velocity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    acceleration_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # pending | approved | rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    topic: Mapped["Topic"] = relationship("Topic")

    def __repr__(self) -> str:
        return f"<SignalRecommendation id={self.id} topic_id={self.topic_id} status={self.status!r}>"
