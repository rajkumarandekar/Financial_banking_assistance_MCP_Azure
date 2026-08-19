import datetime
import uuid
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SCHEMA = "communication_schema"


class CommunicationORM(Base):
    __tablename__ = "communications"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # email | whatsapp | notification
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient: Mapped[Optional[str]] = mapped_column(String(255))  # email address or phone number
    subject: Mapped[Optional[str]] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # sent | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sent")
    sent_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
