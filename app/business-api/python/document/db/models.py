import datetime
import uuid
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SCHEMA = "document_schema"


class DocumentORM(Base):
    __tablename__ = "documents"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # statement | receipt | loan_approval_letter | loan_rejection_letter
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # id of the source record this document was generated from (account_id, payment_id, loan_id, ...)
    related_entity_id: Mapped[Optional[str]] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
