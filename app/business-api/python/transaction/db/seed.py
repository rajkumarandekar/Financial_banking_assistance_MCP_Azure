"""POC demo data seed for transaction_schema.

The original in-memory services.py kept two separate, inconsistent lists
("last_transactions" vs "all_transactions" with different IDs) for account
"1010". That was an artifact of the mock data, not a real design - here there
is one canonical `transactions` table; "last transactions" becomes a query
(most recent N by timestamp) instead of a separately-maintained list. This
seed uses the richer 14-record set from the old `all_transactions["1010"]`.

Section 2 below tops that up with a generated "medium volume" spread across
all 3 seeded accounts (1000/1010/1020) so dashboards/charts have enough real
history to be meaningful - the original 14 rows (all on 1010) were too thin
for a monthly trend chart or category breakdown to look like anything.
Additive only: this never deletes existing rows, so it's safe to run once
against a database that already has the original 14.

Run manually for local dev: `uv run python -m db.seed`
"""

import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from db.base import get_session_factory
from db.models import TransactionORM

logger = logging.getLogger(__name__)


def t(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


NOW = datetime.now(timezone.utc)


# --- Section 2: generated "medium volume" spread -------------------------
# Category set matches the frontend's CATEGORY_COLORS map exactly (Dashboard,
# Credit Cards, Transaction Analytics) - a category string that doesn't match
# renders gray/"Other" in every chart, so every generated row deliberately
# uses one of these 12 (unlike a few of the original 14, which predate that
# convention - e.g. "Supply services"/"Refunds"/"Services"/"Savings" don't
# match and are left as-is rather than rewritten).
CATEGORY_SPEC = {
    "Payroll": dict(flow="income", amt=(2800, 3200), card=False, desc="Monthly Salary - {employer}"),
    "Investment": dict(flow="income", amt=(150, 900), card=False, desc="Investment payout - {fund}"),
    "Utilities": dict(flow="outcome", amt=(60, 220), card=False, desc="{utility} bill payment"),
    "Rent": dict(flow="outcome", amt=(900, 1400), card=False, desc="Monthly rent payment"),
    "Meals": dict(flow="outcome", amt=(15, 140), card=True, desc="{merchant}"),
    "Retail": dict(flow="outcome", amt=(40, 500), card=True, desc="{merchant}"),
    "Subscriptions": dict(flow="outcome", amt=(10, 60), card=True, desc="{merchant} subscription"),
    "Software": dict(flow="outcome", amt=(20, 300), card=True, desc="{merchant} license"),
    "Health": dict(flow="outcome", amt=(30, 400), card=True, desc="{merchant}"),
    "Supplies": dict(flow="outcome", amt=(50, 350), card=False, desc="Office supplies - {merchant}"),
    "Insurance": dict(flow="outcome", amt=(80, 350), card=False, desc="Insurance premium - {merchant}"),
    "Education": dict(flow="outcome", amt=(100, 600), card=False, desc="{merchant} - tuition/course fee"),
}

EMPLOYERS = ["Contoso Ltd", "Fabrikam Inc", "Northwind Traders", "Adventure Works"]
FUNDS = ["Global Equity Fund", "Meridian Growth Fund", "Balanced Income Fund"]
UTILITIES = ["Electricity", "Water", "Gas", "Internet", "Mobile"]
MERCHANTS = [
    "Amazon", "The Coffee House", "Corner Bistro", "Adobe Creative Cloud", "Netflix", "Spotify",
    "City Pharmacy", "Metro Supermarket", "FitLife Gym", "Staples", "TechZone Electronics",
    "Skillbridge Academy",
]
RECIPIENTS = ["ACME", "Contoso", "Contoso Services", "Northwind Utilities", "Fabrikam Health"]


def _rand_amount(rng: random.Random, lo: float, hi: float) -> Decimal:
    return Decimal(str(round(rng.uniform(lo, hi), 2)))


def _generate_transactions(account_id: str, count: int, card_ids: list[str], seed: int) -> list[TransactionORM]:
    """Deterministic, plausible transaction history for one account, spread
    over the last ~9 months - weighted toward expenses (as a real ledger
    would be) with a realistic mix of statuses and card attribution."""
    rng = random.Random(seed)
    categories = list(CATEGORY_SPEC.keys())
    rows: list[TransactionORM] = []
    for i in range(count):
        category = rng.choices(
            categories,
            weights=[3 if CATEGORY_SPEC[c]["flow"] == "income" else 6 for c in categories],
        )[0]
        spec = CATEGORY_SPEC[category]
        days_ago = rng.randint(0, 270)
        ts = NOW - timedelta(days=days_ago, hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
        amount = _rand_amount(rng, *spec["amt"])
        card_id = rng.choice(card_ids) if spec["card"] and card_ids and rng.random() < 0.7 else None
        if days_ago < 3:
            status = rng.choice(["pending", "paid"])
        elif rng.random() < 0.05:
            status = "failed"
        else:
            status = "paid"

        description = spec["desc"].format(
            employer=rng.choice(EMPLOYERS), fund=rng.choice(FUNDS),
            utility=rng.choice(UTILITIES), merchant=rng.choice(MERCHANTS),
        )
        flow_type = spec["flow"]
        txn_type = "deposit" if flow_type == "income" else "payment"
        payment_type = "CreditCard" if card_id else ("Transfer" if flow_type == "income" else "BankTransfer")
        recipient_name = None if flow_type == "income" else rng.choice(RECIPIENTS)

        rows.append(TransactionORM(
            id=f"TXN{account_id}{i:04d}",
            account_id=account_id,
            description=description,
            type=txn_type,
            flow_type=flow_type,
            recipient_name=recipient_name,
            recipient_bank_reference=f"{rng.randint(1000, 9999)}" if recipient_name else None,
            payment_type=payment_type,
            amount=amount,
            timestamp=ts,
            card_id=card_id,
            category=category,
            status=status,
        ))
    return rows


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        # Idempotency guard: this seed has already been run once against the
        # shared dev database (the original 14 rows exist), and this file may
        # be re-run again later - skip any row whose id already exists
        # instead of erroring on a primary-key conflict.
        existing_ids = set((await session.execute(select(TransactionORM.id))).scalars().all())

        original_rows = [
                TransactionORM(
                    id="373737", account_id="1010", description="Home power bill 334398",
                    type="payment", flow_type="outcome", recipient_name="ACME",
                    recipient_bank_reference="0001", payment_type="BankTransfer",
                    amount=160.40, timestamp=NOW, category="Utilities", status="pending",
                ),
                TransactionORM(
                    id="232334", account_id="1010", description="Payment for office supply services",
                    type="payment", flow_type="outcome", recipient_name="Contoso",
                    recipient_bank_reference="0002", payment_type="CreditCard", card_id="55555",
                    amount=215.00, timestamp=t("2025-03-02T12:00:00Z"), category="Supply services", status="paid",
                ),
                TransactionORM(
                    id="3321432", account_id="1010", description="Business Lunch with customer",
                    type="payment", flow_type="outcome", recipient_name="Duff",
                    payment_type="CreditCard", card_id="66666",
                    amount=134.10, timestamp=t("2025-10-03T12:00:00Z"), category="Meals", status="paid",
                ),
                TransactionORM(
                    id="99584", account_id="1010", description="Card withdrawal at atm 00987",
                    type="withdrawal", flow_type="outcome", payment_type="DirectDebit",
                    amount=150.00, card_id="card-3311", timestamp=t("2025-08-04T12:00:00Z"), category="Insurance",
                ),
                TransactionORM(
                    id="99477", account_id="1010", description="Refund for invoice 19dee",
                    type="deposit", flow_type="income", recipient_name="oscorp",
                    recipient_bank_reference="0005", payment_type="BankTransfer",
                    amount=522.00, timestamp=t("2025-04-05T12:00:00Z"), category="Refunds", card_id="card-0098",
                ),
                TransactionORM(
                    id="388373", account_id="1010", description="Gas supply invoice 173645AB435",
                    type="payment", flow_type="outcome", recipient_name="ACME",
                    recipient_bank_reference="A012TABTYT156!", payment_type="BankTransfer",
                    amount=100.00, timestamp=NOW, category="Utilities", status="pending",
                ),
                TransactionORM(
                    id="337733", account_id="1010", description="Plumbing and other services. Bill 998877",
                    type="payment", flow_type="outcome", recipient_name="ACME",
                    recipient_bank_reference="0002", payment_type="BankTransfer",
                    amount=323.00, timestamp=NOW, category="Subscriptions", status="pending",
                ),
                TransactionORM(
                    id="884995", account_id="1010", description="Office Air conditioners. Invoice 355TRA1423FFSSS",
                    type="payment", flow_type="outcome", recipient_name="Contoso Services",
                    recipient_bank_reference="0003", payment_type="DirectDebit",
                    amount=300.00, timestamp=t("2025-10-03T12:00:00Z"), category="Services", status="paid",
                ),
                TransactionORM(
                    id="304984", account_id="1010", description="Insurance monthly payment. Ref:12365GSHT",
                    type="transfer", flow_type="outcome", recipient_name="ACME",
                    recipient_bank_reference="0004", payment_type="Transfer",
                    amount=320.00, timestamp=t("2025-08-04T12:00:00Z"), category="Savings",
                ),
                TransactionORM(
                    id="3946373", account_id="1010", description="Metro and Bus subscription 2023-AB56",
                    type="payment", flow_type="outcome", recipient_name="Speedy Subways",
                    recipient_bank_reference="0005", payment_type="CreditCard", card_id="66666",
                    amount=410.00, timestamp=t("2025-04-05T12:00:00Z"), category="Retail", status="paid",
                ),
                TransactionORM(
                    id="2004764", account_id="1010", description="Medical eyes checkup payment. Ref: MZ23-5567",
                    type="payment", flow_type="outcome", recipient_name="Contoso Health",
                    recipient_bank_reference="0001", payment_type="CreditCard", card_id="66666",
                    amount=230.00, timestamp=t("2025-11-01T12:00:00Z"), category="Health", status="paid",
                ),
                TransactionORM(
                    id="49950598", account_id="1010", description="Payment of the bill 682222",
                    type="payment", flow_type="outcome", recipient_name="Contoso Services",
                    recipient_bank_reference="0002", payment_type="CreditCard", card_id="55555",
                    amount=200.00, timestamp=t("2025-11-02T12:00:00Z"), category="Rent", status="paid",
                ),
                TransactionORM(
                    id="488624", account_id="1010", description="Monthly Salary - StartUp.com",
                    type="deposit", flow_type="income", payment_type="Transfer",
                    amount=3000.00, timestamp=t("2025-10-03T12:00:00Z"), category="Payroll",
                ),
                TransactionORM(
                    id="3004853", account_id="1010", description="Stocks vesting accreditation. www.traderepublic.com - FY25Q3",
                    type="deposit", flow_type="income", payment_type="Transfer",
                    amount=400.00, timestamp=t("2025-08-04T12:00:00Z"), category="Investment",
                ),
                TransactionORM(
                    id="3994853", account_id="1010", description="Withdrawal at ATM 345516",
                    type="withdrawal", flow_type="outcome", payment_type="Transfer", card_id="card-3311",
                    amount=500.00, timestamp=t("2025-11-05T12:00:00Z"), category="Education",
                ),
        ]

        # Section 2 - medium-volume generated spread across all 3 accounts.
        # Card ids are the real ones from account-service's seed:
        # 1010 (bob, EUR) -> 55555 Primary Platinum, 66666 Virtual Gold, 77777 Executive Black
        # 1000 (admin, USD) -> card-1020 Admin Corporate Platinum, card-1021 Admin Corporate Gold
        # 1020 (bob, EUR) -> no cards issued, so no card-tagged rows
        generated_rows = (
            _generate_transactions("1010", 46, ["55555", "66666", "77777"], seed=1010)
            + _generate_transactions("1000", 30, ["card-1020", "card-1021"], seed=1000)
            + _generate_transactions("1020", 15, [], seed=1020)
        )

        new_rows = [r for r in original_rows + generated_rows if r.id not in existing_ids]
        session.add_all(new_rows)
        await session.commit()
    logger.info(f"Seed data inserted: {len(new_rows)} new transactions (skipped {len(existing_ids)} already present)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
