from typing import Optional

import strawberry


@strawberry.type
class CreditScoreType:
    customerId: str
    score: int
    rating: str
    lastUpdated: Optional[str] = None


@strawberry.type
class CreditHistoryEventType:
    id: str
    customerId: str
    eventType: str
    description: Optional[str] = None
    impact: str
    eventDate: Optional[str] = None
