from typing import Optional

import strawberry


@strawberry.type
class DocumentType:
    id: str
    customerId: str
    documentType: str
    relatedEntityId: Optional[str] = None
    title: str
    content: str
    generatedAt: Optional[str] = None


@strawberry.type
class DocumentSummaryType:
    id: str
    documentType: str
    title: str
    generatedAt: Optional[str] = None
