from db.models import DocumentORM
from gql.types import DocumentSummaryType, DocumentType


def orm_to_document(row: DocumentORM) -> DocumentType:
    return DocumentType(
        id=row.id,
        customerId=str(row.customer_id),
        documentType=row.document_type,
        relatedEntityId=row.related_entity_id,
        title=row.title,
        content=row.content,
        generatedAt=row.generated_at.isoformat() if row.generated_at else None,
    )


def orm_to_summary(row: DocumentORM) -> DocumentSummaryType:
    return DocumentSummaryType(
        id=row.id,
        documentType=row.document_type,
        title=row.title,
        generatedAt=row.generated_at.isoformat() if row.generated_at else None,
    )
