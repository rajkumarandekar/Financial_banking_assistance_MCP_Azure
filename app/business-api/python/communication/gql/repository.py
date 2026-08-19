import logging
import uuid
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CommunicationORM

logger = logging.getLogger(__name__)


class CommunicationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def record_communication(
        self,
        comm_id: str,
        customer_id: str,
        channel: str,
        body: str,
        status: str,
        recipient: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> CommunicationORM:
        comm = CommunicationORM(
            id=comm_id,
            customer_id=uuid.UUID(customer_id),
            channel=channel,
            recipient=recipient,
            subject=subject,
            body=body,
            status=status,
        )
        self.session.add(comm)
        await self.session.commit()
        await self.session.refresh(comm)
        return comm

    async def get_history(self, customer_id: str) -> List[CommunicationORM]:
        stmt = (
            select(CommunicationORM)
            .where(CommunicationORM.customer_id == uuid.UUID(customer_id))
            .order_by(desc(CommunicationORM.sent_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
