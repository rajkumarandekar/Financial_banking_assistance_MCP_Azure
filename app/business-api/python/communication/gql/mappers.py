from db.models import CommunicationORM
from gql.types import CommunicationType


def orm_to_communication(row: CommunicationORM) -> CommunicationType:
    return CommunicationType(
        id=row.id,
        customerId=str(row.customer_id),
        channel=row.channel,
        recipient=row.recipient,
        subject=row.subject,
        body=row.body,
        status=row.status,
        sentAt=row.sent_at.isoformat() if row.sent_at else None,
    )
