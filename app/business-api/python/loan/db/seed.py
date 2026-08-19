"""POC demo data seed for loan_schema.

No seed data existed for this service before (Loans/Explore Loans in the
frontend ran entirely on local browser state). This gives customer bob
(bob.user@contoso.com) 3 active loans with real, correctly-computed EMI
schedules (some installments already paid, matching how far into the
tenure the loan's applied_date would put a real borrower today), plus one
pending application and one rejected application for variety. Admin gets
one active loan too, for a non-empty admin view.

EMI amounts use the exact same reducing-balance formula as
gql/repository.py's `_calculate_emi` / `_add_months` (approve_loan) - these
are re-implemented here rather than imported because they're private
helpers local to that module, not a shared/exported utility.

Uses the same two customer UUIDs seeded elsewhere:
  - admin@contoso.com    -> 11111111-1111-1111-1111-111111111111
  - bob.user@contoso.com -> 22222222-2222-2222-2222-222222222222

Run manually for local dev: `uv run python -m db.seed`
"""

import asyncio
import calendar
import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal

from db.base import get_session_factory
from db.models import EmiScheduleORM, LoanORM

logger = logging.getLogger(__name__)

ADMIN_CUSTOMER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
CUSTOMER_CUSTOMER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _calculate_emi(principal: Decimal, annual_rate: Decimal, tenure_months: int) -> Decimal:
    monthly_rate = (float(annual_rate) / 100) / 12
    principal_f = float(principal)
    if monthly_rate == 0:
        return Decimal(str(round(principal_f / tenure_months, 2)))
    factor = (1 + monthly_rate) ** tenure_months
    emi = principal_f * monthly_rate * factor / (factor - 1)
    return Decimal(str(round(emi, 2)))


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _build_active_loan(
    loan_id: str, customer_id: uuid.UUID, account_id: str, loan_type: str,
    principal: float, rate: float, tenure_months: int, applied_days_ago: int,
) -> tuple[LoanORM, list[EmiScheduleORM]]:
    applied = date.today() - timedelta(days=applied_days_ago)
    emi_amount = _calculate_emi(Decimal(str(principal)), Decimal(str(rate)), tenure_months)
    loan = LoanORM(
        id=loan_id, customer_id=customer_id, account_id=account_id, loan_type=loan_type,
        principal_amount=Decimal(str(principal)), interest_rate=Decimal(str(rate)),
        tenure_months=tenure_months, status="active", applied_date=applied, decision_date=applied,
    )
    months_elapsed = min(applied_days_ago // 30, tenure_months)
    schedule = [
        EmiScheduleORM(
            id=f"{loan_id}-{i:03d}", loan_id=loan_id, installment_number=i,
            due_date=_add_months(applied, i), amount=emi_amount,
            status="paid" if i <= months_elapsed else "pending",
        )
        for i in range(1, tenure_months + 1)
    ]
    return loan, schedule


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        car, car_schedule = _build_active_loan(
            "LNBOBCAR001", CUSTOMER_CUSTOMER_ID, "1010", "auto", 18000, 7.5, 36, applied_days_ago=300
        )
        personal, personal_schedule = _build_active_loan(
            "LNBOBPER001", CUSTOMER_CUSTOMER_ID, "1010", "personal", 8000, 10.75, 24, applied_days_ago=150
        )
        home, home_schedule = _build_active_loan(
            "LNBOBHOM001", CUSTOMER_CUSTOMER_ID, "1010", "home", 150000, 8.65, 240, applied_days_ago=450
        )
        admin_personal, admin_schedule = _build_active_loan(
            "LNADMPER001", ADMIN_CUSTOMER_ID, "1000", "personal", 10000, 6.5, 36, applied_days_ago=200
        )

        session.add_all([car, personal, home, admin_personal])
        session.add_all(car_schedule + personal_schedule + home_schedule + admin_schedule)

        session.add_all([
            # Under review - no decision yet, no EMI schedule.
            LoanORM(
                id="LNBOBEDU001", customer_id=CUSTOMER_CUSTOMER_ID, account_id="1010",
                loan_type="education", principal_amount=Decimal("6000"), interest_rate=Decimal("9.5"),
                tenure_months=48, status="pending", applied_date=date.today() - timedelta(days=10),
            ),
            # Rejected - decided, no EMI schedule.
            LoanORM(
                id="LNBOBREJ001", customer_id=CUSTOMER_CUSTOMER_ID, account_id="1010",
                loan_type="personal", principal_amount=Decimal("3000"), interest_rate=Decimal("12"),
                tenure_months=12, status="rejected",
                applied_date=date.today() - timedelta(days=60), decision_date=date.today() - timedelta(days=55),
                rejection_reason="Debt-to-income ratio too high",
            ),
        ])

        await session.commit()
    logger.info("Seed data inserted: 6 loans (4 active with EMI schedules, 1 pending, 1 rejected)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
