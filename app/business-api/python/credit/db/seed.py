"""POC demo data seed for credit_schema.

Uses the same two customer UUIDs seeded elsewhere:
  - admin@contoso.com    -> 11111111-1111-1111-1111-111111111111
  - bob.user@contoso.com -> 22222222-2222-2222-2222-222222222222

CreditScoreORM is one row per customer (customer_id is the primary key) - the
schema has no time-series/snapshot table, so there is no way to seed a real
score-history trend here; only CreditHistoryEventORM (a qualitative event
log) can be given real depth. Section 2 below adds ~16 more events spread
over the last year so that timeline isn't just 4 entries.

Run manually for local dev: `uv run python -m db.seed`
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from db.base import get_session_factory
from db.models import CreditHistoryEventORM, CreditScoreORM

logger = logging.getLogger(__name__)

ADMIN_CUSTOMER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
CUSTOMER_CUSTOMER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

NOW = datetime.now(timezone.utc)


def _days_ago(n: int) -> datetime:
    return NOW - timedelta(days=n)


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        # Idempotency guard: skip anything already present instead of
        # erroring on a primary-key conflict on re-run.
        existing_score_ids = set((await session.execute(select(CreditScoreORM.customer_id))).scalars().all())
        existing_event_ids = set((await session.execute(select(CreditHistoryEventORM.id))).scalars().all())

        scores = [
            CreditScoreORM(customer_id=ADMIN_CUSTOMER_ID, score=780, rating="excellent"),
            CreditScoreORM(customer_id=CUSTOMER_CUSTOMER_ID, score=690, rating="good"),
        ]
        events = [
                CreditHistoryEventORM(
                    id="CH0001", customer_id=CUSTOMER_CUSTOMER_ID, event_type="credit_check",
                    description="Routine annual credit check", impact="neutral",
                ),
                CreditHistoryEventORM(
                    id="CH0002", customer_id=CUSTOMER_CUSTOMER_ID, event_type="loan_taken",
                    description="Personal loan of 5000 EUR approved", impact="neutral",
                ),
                CreditHistoryEventORM(
                    id="CH0003", customer_id=CUSTOMER_CUSTOMER_ID, event_type="payment_missed",
                    description="Missed credit card payment (30 days late)", impact="negative",
                ),
                CreditHistoryEventORM(
                    id="CH0004", customer_id=ADMIN_CUSTOMER_ID, event_type="credit_check",
                    description="Routine annual credit check", impact="neutral",
                ),
        ]

        # Section 2 - a fuller year of history for both customers so the
        # timeline reads as an actual track record, not 4 isolated entries.
        events += [
                # bob.user@contoso.com (CUSTOMER_CUSTOMER_ID)
                CreditHistoryEventORM(id="CH0005", customer_id=CUSTOMER_CUSTOMER_ID, event_type="payment_on_time",
                    description="Personal loan EMI paid on time", impact="positive", event_date=_days_ago(20)),
                CreditHistoryEventORM(id="CH0006", customer_id=CUSTOMER_CUSTOMER_ID, event_type="utilization_decrease",
                    description="Credit card utilization dropped below 30%", impact="positive", event_date=_days_ago(35)),
                CreditHistoryEventORM(id="CH0007", customer_id=CUSTOMER_CUSTOMER_ID, event_type="payment_on_time",
                    description="Home loan EMI paid on time", impact="positive", event_date=_days_ago(50)),
                CreditHistoryEventORM(id="CH0008", customer_id=CUSTOMER_CUSTOMER_ID, event_type="inquiry_soft",
                    description="Pre-approved offer eligibility check", impact="neutral", event_date=_days_ago(75)),
                CreditHistoryEventORM(id="CH0009", customer_id=CUSTOMER_CUSTOMER_ID, event_type="utilization_increase",
                    description="Credit card utilization rose above 50%", impact="negative", event_date=_days_ago(110)),
                CreditHistoryEventORM(id="CH0010", customer_id=CUSTOMER_CUSTOMER_ID, event_type="loan_taken",
                    description="Home loan of 150000 EUR approved", impact="neutral", event_date=_days_ago(150)),
                CreditHistoryEventORM(id="CH0011", customer_id=CUSTOMER_CUSTOMER_ID, event_type="new_card_opened",
                    description="New credit card - Executive Black - opened", impact="neutral", event_date=_days_ago(190)),
                CreditHistoryEventORM(id="CH0012", customer_id=CUSTOMER_CUSTOMER_ID, event_type="payment_on_time",
                    description="Car loan EMI paid on time", impact="positive", event_date=_days_ago(220)),
                CreditHistoryEventORM(id="CH0013", customer_id=CUSTOMER_CUSTOMER_ID, event_type="inquiry_hard",
                    description="Credit card application - hard inquiry", impact="negative", event_date=_days_ago(260)),
                CreditHistoryEventORM(id="CH0014", customer_id=CUSTOMER_CUSTOMER_ID, event_type="loan_taken",
                    description="Car loan of 18000 EUR approved", impact="neutral", event_date=_days_ago(300)),
                CreditHistoryEventORM(id="CH0015", customer_id=CUSTOMER_CUSTOMER_ID, event_type="credit_check",
                    description="Routine annual credit check", impact="neutral", event_date=_days_ago(340)),
                # admin@contoso.com (ADMIN_CUSTOMER_ID)
                CreditHistoryEventORM(id="CH0016", customer_id=ADMIN_CUSTOMER_ID, event_type="payment_on_time",
                    description="Corporate card balance paid in full", impact="positive", event_date=_days_ago(30)),
                CreditHistoryEventORM(id="CH0017", customer_id=ADMIN_CUSTOMER_ID, event_type="utilization_decrease",
                    description="Credit utilization dropped below 20%", impact="positive", event_date=_days_ago(95)),
                CreditHistoryEventORM(id="CH0018", customer_id=ADMIN_CUSTOMER_ID, event_type="new_card_opened",
                    description="New corporate card - Admin Corporate Gold - opened", impact="neutral", event_date=_days_ago(180)),
                CreditHistoryEventORM(id="CH0019", customer_id=ADMIN_CUSTOMER_ID, event_type="payment_on_time",
                    description="Personal loan EMI paid on time", impact="positive", event_date=_days_ago(260)),
                CreditHistoryEventORM(id="CH0020", customer_id=ADMIN_CUSTOMER_ID, event_type="inquiry_soft",
                    description="Pre-approved offer eligibility check", impact="neutral", event_date=_days_ago(320)),
        ]

        new_scores = [s for s in scores if s.customer_id not in existing_score_ids]
        new_events = [e for e in events if e.id not in existing_event_ids]
        session.add_all(new_scores)
        session.add_all(new_events)
        await session.commit()
    logger.info(f"Seed data inserted: {len(new_scores)} new credit scores, {len(new_events)} new credit history events")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
