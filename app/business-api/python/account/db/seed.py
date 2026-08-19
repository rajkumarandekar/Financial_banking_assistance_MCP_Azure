"""POC demo data seed for account_schema.

Two demo identities (matched by app/backend/app/helpers/demo_customer_map.py):
  - admin@contoso.com    -> customer_id 11111111-1111-1111-1111-111111111111 -> owns account "1000"
  - bob.user@contoso.com -> customer_id 22222222-2222-2222-2222-222222222222 -> owns accounts "1010" and "1020"

Admin role sees ALL accounts regardless of ownership (enforced in mcp_tools.py / graphql resolvers,
not by this seed data).

Run manually for local dev: `uv run python -m db.seed`
"""

import asyncio
import logging
import uuid
from datetime import date

from db.base import get_session_factory
from db.models import AccountORM, BeneficiaryORM, CardORM, PaymentMethodORM

logger = logging.getLogger(__name__)

ADMIN_CUSTOMER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
CUSTOMER_CUSTOMER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def d(iso_date: str) -> date:
    """asyncpg requires real date objects, not 'YYYY-MM-DD' strings."""
    return date.fromisoformat(iso_date)


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add_all(
            [
                AccountORM(
                    id="1000",
                    customer_id=ADMIN_CUSTOMER_ID,
                    user_name="admin@contoso.com",
                    account_holder_full_name="Admin User",
                    currency="USD",
                    activation_date=d("2022-01-01"),
                    balance=5000,
                ),
                AccountORM(
                    id="1010",
                    customer_id=CUSTOMER_CUSTOMER_ID,
                    user_name="bob.user@contoso.com",
                    account_holder_full_name="Bob User",
                    currency="EUR",
                    activation_date=d("2022-01-01"),
                    balance=185000,
                ),
                AccountORM(
                    id="1020",
                    customer_id=CUSTOMER_CUSTOMER_ID,
                    user_name="bob.user@contoso.com",
                    account_holder_full_name="Bob User",
                    currency="EUR",
                    activation_date=d("2022-01-01"),
                    balance=3000,
                ),
            ]
        )

        session.add_all(
            [
                PaymentMethodORM(
                    id="12345", account_id="1000", type="Visa", name=None,
                    activation_date=d("2022-01-01"), expiration_date=d("2025-01-01"),
                    available_balance=500.0, card_number="1234567812345678",
                ),
                PaymentMethodORM(
                    id="23456", account_id="1000", type="BankTransfer",
                    activation_date=d("2022-01-01"), expiration_date=d("9999-01-01"),
                    available_balance=5000.0,
                ),
                PaymentMethodORM(
                    id="345678", account_id="1010", type="BankTransfer",
                    activation_date=d("2022-01-01"), expiration_date=d("9999-01-01"),
                    available_balance=10000.0,
                ),
                PaymentMethodORM(
                    id="55555", account_id="1010", type="Visa", name="Primary Platinum",
                    activation_date=d("2024-03-01"), expiration_date=d("2027-03-01"),
                    available_balance=350.0, card_number="637362551913266",
                ),
                PaymentMethodORM(
                    id="66666", account_id="1010", type="Visa", name="Secondary Gold",
                    activation_date=d("2025-11-01"), expiration_date=d("2028-11-01"),
                ),
                PaymentMethodORM(
                    id="46748576", account_id="1020", type="DirectDebit",
                    activation_date=d("2022-02-01"), expiration_date=d("9999-02-01"),
                ),
            ]
        )

        session.add_all(
            [
                CardORM(
                    id="card-1020", account_id="1000", type="credit", name="Admin Corporate Platinum",
                    activation_date=d("2023-01-01"), expiration_date=d("2028-01-01"),
                    balance=1200.0, number="4111222233334444", limit_amount=15000.0, status="active",
                ),
                CardORM(
                    id="card-1021", account_id="1000", type="credit", name="Admin Corporate Gold",
                    activation_date=d("2022-06-01"), expiration_date=d("2027-06-01"),
                    balance=750.0, number="4111222233335555", limit_amount=5000.0, status="active",
                ),
                CardORM(
                    id="55555", account_id="1010", type="credit", circuit="visa", name="Primary Platinum",
                    activation_date=d("2024-03-01"), expiration_date=d("2027-03-01"),
                    balance=42500.0, number="5111222233335555", limit_amount=150000.0, status="active",
                ),
                CardORM(
                    id="66666", account_id="1010", type="recharge", circuit="visa", name="Virtual Gold",
                    activation_date=d("2025-11-01"), expiration_date=d("2028-11-01"),
                    balance=18500.0, recharged_amount=25000, number="5211222233336666",
                    limit_amount=75000.0, status="active",
                ),
                CardORM(
                    id="77777", account_id="1010", type="credit", circuit="amex", name="Executive Black",
                    activation_date=d("2024-02-01"), expiration_date=d("2029-02-01"),
                    balance=0, number="5311222233337777", limit_amount=300000.0, status="blocked",
                ),
            ]
        )

        session.add_all(
            [
                BeneficiaryORM(
                    id="1", account_id="1010", full_name="Mike ThePlumber",
                    bank_code="123456789", bank_name="Intesa Sanpaolo",
                ),
                BeneficiaryORM(
                    id="2", account_id="1010", full_name="Jane TheElectrician",
                    bank_code="987654321", bank_name="UBS",
                ),
            ]
        )

        await session.commit()
    logger.info("Seed data inserted: 3 accounts (1000=admin, 1010/1020=customer)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
