import datetime
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SCHEMA = "payment_schema"


class PaymentORM(Base):
    __tablename__ = "payments"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    # Set from the validated caller identity at creation time (after an
    # account-ownership check against account-service) - not re-derived from
    # account_id on every read, to avoid a cross-service call per query.
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    recipient_name: Mapped[Optional[str]] = mapped_column(String(255))
    recipient_bank_code: Mapped[Optional[str]] = mapped_column(String(50))
    payment_type: Mapped[Optional[str]] = mapped_column(String(50))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    card_id: Mapped[Optional[str]] = mapped_column(String(20))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    # processing | paid | pending | failed | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    failure_reason: Mapped[Optional[str]] = mapped_column(String(500))
    # id of the transaction created in transaction-service once notified successfully
    transaction_id: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
