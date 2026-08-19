import datetime
import uuid
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SCHEMA = "customer_schema"


class CustomerORM(Base):
    """The platform-wide source of truth for customer_id and role.

    account_schema.accounts.customer_id (and every other domain service's
    customer_id column) is a staged, unconstrained FK to this table's id -
    see app/business-api/python/account/db/models.py's comment for the
    ALTER TABLE to add once cross-schema FKs are wanted.
    """

    __tablename__ = "customers"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    # "admin" | "customer" - POC role model; a real system would separate
    # roles/permissions into their own table once more than 2 roles exist.
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="customer")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
