"""POC demo data seed for customer_schema.

Uses the SAME two UUIDs already seeded into account_schema.accounts.customer_id
(app/business-api/python/account/db/seed.py) and referenced by
app/backend/app/helpers/demo_customer_map.py, so the two datasets line up:
  - admin@contoso.com    -> 11111111-1111-1111-1111-111111111111 -> role admin
  - bob.user@contoso.com -> 22222222-2222-2222-2222-222222222222 -> role customer

Run manually for local dev: `uv run python -m db.seed`
"""

import asyncio
import logging
import uuid

from db.base import get_session_factory
from db.models import CustomerORM

logger = logging.getLogger(__name__)

ADMIN_CUSTOMER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
CUSTOMER_CUSTOMER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add_all(
            [
                CustomerORM(
                    id=ADMIN_CUSTOMER_ID,
                    email="admin@contoso.com",
                    full_name="Admin User",
                    phone="+1-555-0100",
                    role="admin",
                ),
                CustomerORM(
                    id=CUSTOMER_CUSTOMER_ID,
                    email="bob.user@contoso.com",
                    full_name="Bob User",
                    phone="+1-555-0101",
                    role="customer",
                ),
            ]
        )
        await session.commit()
    logger.info("Seed data inserted: 2 customers (admin, bob.user)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
