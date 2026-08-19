import datetime
import logging
import uuid
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CreditHistoryEventORM, CreditScoreORM

logger = logging.getLogger(__name__)

# Asymmetric on purpose - real credit scoring punishes a missed payment harder
# than it rewards an on-time one (payment history is ~35% of a real FICO
# score, and late payments are the single biggest negative factor).
IMPACT_DELTA = {"positive": 5, "negative": -15, "neutral": 0}
SCORE_MIN, SCORE_MAX = 300, 850


def _rating_for(score: int) -> str:
    if score >= 800:
        return "excellent"
    if score >= 740:
        return "very_good"
    if score >= 670:
        return "good"
    if score >= 580:
        return "fair"
    return "poor"


class CreditRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_credit_score(self, customer_id: str) -> Optional[CreditScoreORM]:
        stmt = select(CreditScoreORM).where(CreditScoreORM.customer_id == uuid.UUID(customer_id))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_credit_history(self, customer_id: str) -> List[CreditHistoryEventORM]:
        stmt = (
            select(CreditHistoryEventORM)
            .where(CreditHistoryEventORM.customer_id == uuid.UUID(customer_id))
            .order_by(desc(CreditHistoryEventORM.event_date))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def record_credit_event(
        self, customer_id: str, event_id: str, event_type: str, description: Optional[str], impact: str
    ) -> CreditHistoryEventORM:
        """Logs the event AND actually moves the score - previously this only
        wrote a history row with no effect on credit_scores.score at all, so
        the number shown to the customer never changed no matter what they
        did (confirmed live: a real payment left the score byte-for-byte
        identical). Every positive/negative event now nudges the score by
        IMPACT_DELTA, clamped to the real 300-850 range, with rating
        recomputed from the new score every time so it can never drift out
        of sync."""
        event = CreditHistoryEventORM(
            id=event_id,
            customer_id=uuid.UUID(customer_id),
            event_type=event_type,
            description=description,
            impact=impact,
        )
        self.session.add(event)

        delta = IMPACT_DELTA.get(impact, 0)
        if delta != 0:
            score_row = await self.get_credit_score(customer_id)
            if score_row is not None:
                score_row.score = max(SCORE_MIN, min(SCORE_MAX, score_row.score + delta))
                score_row.rating = _rating_for(score_row.score)
                score_row.last_updated = datetime.datetime.now(datetime.timezone.utc)

        await self.session.commit()
        await self.session.refresh(event)
        return event
