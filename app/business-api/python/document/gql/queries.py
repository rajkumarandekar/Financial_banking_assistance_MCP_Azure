from typing import List, Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import DocumentRepository
from gql.types import DocumentSummaryType, DocumentType


@strawberry.type
class Query:
    @strawberry.field
    async def document(self, info: Info, document_id: str) -> Optional[DocumentType]:
        repo = DocumentRepository(info.context["db_session"])
        row = await repo.get_document(document_id)
        return mappers.orm_to_document(row) if row else None

    @strawberry.field
    async def documents_by_customer(self, info: Info, customer_id: str) -> List[DocumentSummaryType]:
        repo = DocumentRepository(info.context["db_session"])
        rows = await repo.get_documents_by_customer(customer_id)
        return [mappers.orm_to_summary(row) for row in rows]
