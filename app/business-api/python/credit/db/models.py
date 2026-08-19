import datetime
import uuid
from typing import Optional

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SCHEMA = "credit_schema"


class CreditScoreORM(Base):
    __tablename__ = "credit_scores"
    __table_args__ = {"schema": SCHEMA}

    # One current score row per customer - staged FK to customer_schema.customers.id.
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 300-850 (standard FICO-like range)
    rating: Mapped[str] = mapped_column(String(20), nullable=False)  # poor|fair|good|very_good|excellent
    last_updated: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )


class CreditHistoryEventORM(Base):
    __tablename__ = "credit_history"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # loan_taken, payment_missed, credit_check, ...
    description: Mapped[Optional[str]] = mapped_column(String(500))
    impact: Mapped[str] = mapped_column(String(10), nullable=False, default="neutral")  # positive|negative|neutral
    event_date: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
