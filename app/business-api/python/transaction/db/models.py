import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SCHEMA = "transaction_schema"


class TransactionORM(Base):
    __tablename__ = "transactions"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    # Unconstrained cross-schema reference to account_schema.accounts.id -
    # same staged-FK pattern as account_schema.accounts.customer_id.
    account_id: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    # deposit, withdrawal, transfer, payment
    type: Mapped[Optional[str]] = mapped_column(String(20))
    # income | outcome
    flow_type: Mapped[Optional[str]] = mapped_column(String(10))
    recipient_name: Mapped[Optional[str]] = mapped_column(String(255))
    recipient_bank_reference: Mapped[Optional[str]] = mapped_column(String(100))
    # BankTransfer, DirectDebit, CreditCard, Transfer
    payment_type: Mapped[Optional[str]] = mapped_column(String(50))
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    card_id: Mapped[Optional[str]] = mapped_column(String(20))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    # paid, pending, failed
    status: Mapped[Optional[str]] = mapped_column(String(20))
