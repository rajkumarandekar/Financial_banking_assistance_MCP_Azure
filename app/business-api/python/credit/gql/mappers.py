from db.models import CreditHistoryEventORM, CreditScoreORM
from gql.types import CreditHistoryEventType, CreditScoreType


def orm_to_credit_score(row: CreditScoreORM) -> CreditScoreType:
    return CreditScoreType(
        customerId=str(row.customer_id),
        score=row.score,
        rating=row.rating,
        lastUpdated=row.last_updated.isoformat() if row.last_updated else None,
    )


def orm_to_credit_history_event(row: CreditHistoryEventORM) -> CreditHistoryEventType:
    return CreditHistoryEventType(
        id=row.id,
        customerId=str(row.customer_id),
        eventType=row.event_type,
        description=row.description,
        impact=row.impact,
        eventDate=row.event_date.isoformat() if row.event_date else None,
    )
