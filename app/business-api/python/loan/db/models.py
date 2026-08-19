import datetime
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

SCHEMA = "loan_schema"


class LoanORM(Base):
    __tablename__ = "loans"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    # Staged FK to customer_schema.customers.id - same unconstrained pattern as
    # account_schema.accounts.customer_id.
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # Optional staged FK to account_schema.accounts.id (disbursement/repayment account).
    account_id: Mapped[Optional[str]] = mapped_column(String(20))
    loan_type: Mapped[str] = mapped_column(String(50), nullable=False)  # personal, home, auto, education
    principal_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    tenure_months: Mapped[int] = mapped_column(Integer, nullable=False)
    # pending | approved | rejected | active | closed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    applied_date: Mapped[datetime.date] = mapped_column(
        Date, default=lambda: datetime.date.today()
    )
    decision_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )

    emi_schedule: Mapped[list["EmiScheduleORM"]] = relationship(
        back_populates="loan", cascade="all, delete-orphan", order_by="EmiScheduleORM.installment_number"
    )


class EmiScheduleORM(Base):
    __tablename__ = "emi_schedule"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    loan_id: Mapped[str] = mapped_column(
        String(20), ForeignKey(f"{SCHEMA}.loans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    installment_number: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    # pending | paid | overdue
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    loan: Mapped["LoanORM"] = relationship(back_populates="emi_schedule")
