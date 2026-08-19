import logging
import uuid
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import DocumentORM

logger = logging.getLogger(__name__)


class DocumentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_document(
        self, document_id: str, customer_id: str, document_type: str, title: str, content: str, related_entity_id: Optional[str] = None
    ) -> DocumentORM:
        doc = DocumentORM(
            id=document_id,
            customer_id=uuid.UUID(customer_id),
            document_type=document_type,
            related_entity_id=related_entity_id,
            title=title,
            content=content,
        )
        self.session.add(doc)
        await self.session.commit()
        await self.session.refresh(doc)
        return doc

    async def get_document(self, document_id: str) -> Optional[DocumentORM]:
        stmt = select(DocumentORM).where(DocumentORM.id == document_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_documents_by_customer(self, customer_id: str) -> List[DocumentORM]:
        stmt = (
            select(DocumentORM)
            .where(DocumentORM.customer_id == uuid.UUID(customer_id))
            .order_by(desc(DocumentORM.generated_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
