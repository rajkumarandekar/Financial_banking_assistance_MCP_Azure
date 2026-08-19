import datetime
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SCHEMA = "investment_schema"


class StockPriceORM(Base):
    """The Alpha Vantage price cache - the only table this service's price-
    refresh job writes to. Holdings always read current price from here,
    never call the remote MCP server themselves (keeps every read free and
    fast, and keeps us inside the 25 req/day free-tier budget no matter how
    many times the UI is opened)."""
    __tablename__ = "stock_prices"
    __table_args__ = {"schema": SCHEMA}

    symbol: Mapped[str] = mapped_column(String(20), primary_key=True)
    # The exact string sent to Alpha Vantage's GLOBAL_QUOTE (e.g. "RELIANCE.BSE") -
    # kept separate from the plain display symbol since the two don't have to
    # match 1:1 depending on how Alpha Vantage resolves the exchange suffix.
    exchange_symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    company_name: Mapped[Optional[str]] = mapped_column(String(255))
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    change: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2))
    change_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    volume: Mapped[Optional[int]] = mapped_column()
    last_refreshed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True))
    # Set when the last refresh attempt for this symbol failed (rate limit,
    # symbol not found, etc.) - the UI can show "price may be stale" instead
    # of silently showing a old/zero value as if it were fresh.
    last_error: Mapped[Optional[str]] = mapped_column(String(500))


class HoldingORM(Base):
    __tablename__ = "holdings"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    # Staged FK to customer_schema.customers.id - same unconstrained pattern
    # every other service uses (customer-service isn't cross-schema FK'd anywhere).
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(20))
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector: Mapped[Optional[str]] = mapped_column(String(100))
    shares: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    # Weighted-average cost - recomputed on every additional buy, same
    # convention the frontend's local simulation used before this service existed.
    avg_purchase_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )


class StockTransactionORM(Base):
    __tablename__ = "stock_transactions"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    account_id: Mapped[Optional[str]] = mapped_column(String(20))
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # buy | sell
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    shares: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    executed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
