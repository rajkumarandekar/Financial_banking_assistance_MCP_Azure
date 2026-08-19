import datetime
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, CHAR, Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

SCHEMA = "account_schema"


class AccountORM(Base):
    __tablename__ = "accounts"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    # Staged FK: no constraint yet because customer_schema.customers does not exist.
    # Once customer-service exists, add:
    #   ALTER TABLE account_schema.accounts ADD CONSTRAINT fk_accounts_customer
    #       FOREIGN KEY (customer_id) REFERENCES customer_schema.customers(id);
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    account_holder_full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False)
    activation_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )

    payment_methods: Mapped[list["PaymentMethodORM"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    cards: Mapped[list["CardORM"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    beneficiaries: Mapped[list["BeneficiaryORM"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class PaymentMethodORM(Base):
    __tablename__ = "payment_methods"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(20), ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    activation_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    expiration_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    available_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    card_number: Mapped[Optional[str]] = mapped_column(String(32))
    status: Mapped[Optional[str]] = mapped_column(String(20))

    account: Mapped["AccountORM"] = relationship(back_populates="payment_methods")


class CardORM(Base):
    __tablename__ = "cards"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(20), ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    circuit: Mapped[Optional[str]] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    activation_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    expiration_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), default=0)
    recharged_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    number: Mapped[Optional[str]] = mapped_column(String(32))
    limit_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    status: Mapped[Optional[str]] = mapped_column(String(20))
    cvv: Mapped[Optional[str]] = mapped_column(String(4))
    # Orthogonal to status - a card can be "active" (not blocked/expired) and
    # still frozen (temporarily disabled by the cardholder).
    frozen: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    account: Mapped["AccountORM"] = relationship(back_populates="cards")
    security_settings: Mapped[Optional["CardSecuritySettingsORM"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", uselist=False
    )
    limit_requests: Mapped[list["CardLimitRequestORM"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )


class CardSecuritySettingsORM(Base):
    __tablename__ = "card_security_settings"
    __table_args__ = {"schema": SCHEMA}

    card_id: Mapped[str] = mapped_column(
        String(20), ForeignKey(f"{SCHEMA}.cards.id", ondelete="CASCADE"), primary_key=True
    )
    online_transactions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    international_transactions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    contactless_payments: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    atm_withdrawals: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    daily_transaction_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=50000)
    daily_online_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=25000)

    card: Mapped["CardORM"] = relationship(back_populates="security_settings")


class CardLimitRequestORM(Base):
    __tablename__ = "card_limit_requests"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    card_id: Mapped[str] = mapped_column(
        String(20), ForeignKey(f"{SCHEMA}.cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    current_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    requested_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    # under_review | approved | rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="under_review")
    submitted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    card: Mapped["CardORM"] = relationship(back_populates="limit_requests")


class BeneficiaryORM(Base):
    __tablename__ = "beneficiaries"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        String(20), ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bank_code: Mapped[str] = mapped_column(String(50), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)

    account: Mapped["AccountORM"] = relationship(back_populates="beneficiaries")
