"""POC demo data seed for payment_schema.

No seed data existed for this service before (the frontend's Payments
screen ran entirely on local browser state - see paymentActionService.ts).
This gives customer bob a real payment history with a realistic status mix
(mostly paid, a few pending/failed/cancelled) spread over the last ~2
months, plus a smaller set for admin.

Uses the same customer/account id space as the other services:
  - admin@contoso.com    -> customer 11111111-1111-1111-1111-111111111111, account 1000
  - bob.user@contoso.com -> customer 22222222-2222-2222-2222-222222222222, accounts 1010/1020

Run manually for local dev: `uv run python -m db.seed`
"""

import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from db.base import get_session_factory
from db.models import PaymentORM

logger = logging.getLogger(__name__)

ADMIN_CUSTOMER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
CUSTOMER_CUSTOMER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")

NOW = datetime.now(timezone.utc)

# (category, description template, amount low, amount high, recipient, payment_type, card_id or None)
BILL_SPEC = [
    ("Utilities", "Electricity bill payment", 60, 220, "Northwind Utilities", "BankTransfer", None),
    ("Utilities", "Internet & broadband bill", 40, 90, "Fabrikam Telecom", "DirectDebit", None),
    ("Rent", "Monthly rent payment", 900, 1400, "City Properties", "BankTransfer", None),
    ("Insurance", "Health insurance premium", 80, 350, "Fabrikam Health", "DirectDebit", None),
    ("Subscriptions", "Streaming subscription bundle", 15, 45, "Contoso Media", "CreditCard", "55555"),
    ("Retail", "Online marketplace order", 40, 500, "Contoso Retail", "CreditCard", "77777"),
    ("Education", "Course platform tuition fee", 100, 600, "Skillbridge Academy", "BankTransfer", None),
    ("Supplies", "Office/home supplies order", 50, 350, "Staples", "CreditCard", "66666"),
]


def _rand_amount(rng: random.Random, lo: float, hi: float) -> Decimal:
    return Decimal(str(round(rng.uniform(lo, hi), 2)))


def _generate_payments(
    account_id: str, customer_id: uuid.UUID, count: int, id_prefix: str, seed: int
) -> list[PaymentORM]:
    rng = random.Random(seed)
    rows: list[PaymentORM] = []
    for i in range(count):
        category, desc, lo, hi, recipient, payment_type, card_id = rng.choice(BILL_SPEC)
        days_ago = rng.randint(0, 60)
        created = NOW - timedelta(days=days_ago, hours=rng.randint(0, 23))
        roll = rng.random()
        if days_ago < 2:
            status, failure_reason, transaction_id = rng.choice(["pending", "paid"]), None, None
        elif roll < 0.12:
            status = "failed"
            failure_reason = rng.choice([
                "Insufficient funds", "Recipient bank rejected the transfer", "Card declined by issuer",
            ])
            transaction_id = None
        elif roll < 0.17:
            status, failure_reason, transaction_id = "cancelled", None, None
        else:
            status, failure_reason = "paid", None
            transaction_id = f"TXN{account_id}{9000 + i:04d}"

        rows.append(PaymentORM(
            id=f"{id_prefix}{i:04d}",
            customer_id=customer_id,
            account_id=account_id,
            description=desc,
            recipient_name=recipient,
            recipient_bank_code=f"{rng.randint(1000, 9999)}",
            payment_type=payment_type,
            amount=_rand_amount(rng, lo, hi),
            card_id=card_id,
            category=category,
            status=status,
            failure_reason=failure_reason,
            transaction_id=transaction_id,
            created_at=created,
            updated_at=created,
        ))
    return rows


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add_all(_generate_payments("1010", CUSTOMER_CUSTOMER_ID, 18, "PAYBOB", seed=2010))
        session.add_all(_generate_payments("1000", ADMIN_CUSTOMER_ID, 5, "PAYADM", seed=2000))
        await session.commit()
    logger.info("Seed data inserted: 23 payments (18 for bob's account 1010, 5 for admin's account 1000)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
