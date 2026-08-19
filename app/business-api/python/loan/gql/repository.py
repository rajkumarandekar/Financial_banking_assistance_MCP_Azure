import calendar
import logging
import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from credit_service_client import record_credit_event
from db.models import EmiScheduleORM, LoanORM

logger = logging.getLogger(__name__)


def _add_months(start: date, months: int) -> date:
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _calculate_emi(principal: Decimal, annual_rate: Decimal, tenure_months: int) -> Decimal:
    """Standard reducing-balance EMI formula."""
    monthly_rate = (annual_rate / Decimal(100)) / Decimal(12)
    if monthly_rate == 0:
        return round(principal / tenure_months, 2)
    factor = (1 + monthly_rate) ** tenure_months
    emi = principal * monthly_rate * factor / (factor - 1)
    return round(emi, 2)


class LoanRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def apply_loan(
        self,
        customer_id: str,
        loan_type: str,
        principal_amount: float,
        interest_rate: float,
        tenure_months: int,
        account_id: Optional[str] = None,
    ) -> LoanORM:
        logger.info("apply_loan customer_id=%s loan_type=%s principal=%s", customer_id, loan_type, principal_amount)
        if principal_amount <= 0:
            raise ValueError("principal_amount must be greater than zero")
        if tenure_months <= 0:
            raise ValueError("tenure_months must be greater than zero")
        loan = LoanORM(
            id="LN" + uuid.uuid4().hex[:10].upper(),
            customer_id=uuid.UUID(customer_id),
            account_id=account_id,
            loan_type=loan_type,
            principal_amount=Decimal(str(principal_amount)),
            interest_rate=Decimal(str(interest_rate)),
            tenure_months=tenure_months,
            status="pending",
            applied_date=date.today(),
        )
        self.session.add(loan)
        await self.session.commit()
        await self.session.refresh(loan)
        return loan

    async def get_loans_by_customer(self, customer_id: str) -> List[LoanORM]:
        stmt = (
            select(LoanORM)
            .where(LoanORM.customer_id == uuid.UUID(customer_id))
            .options(selectinload(LoanORM.emi_schedule))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_all_loans(self) -> List[LoanORM]:
        """Admin-only operation (enforced by callers, not here)."""
        stmt = select(LoanORM).options(selectinload(LoanORM.emi_schedule))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_loan_details(self, loan_id: str) -> Optional[LoanORM]:
        stmt = select(LoanORM).where(LoanORM.id == loan_id).options(selectinload(LoanORM.emi_schedule))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _require_loan(self, loan_id: str) -> LoanORM:
        loan = await self.get_loan_details(loan_id)
        if loan is None:
            raise RuntimeError(f"Loan {loan_id} not found")
        return loan

    async def approve_loan(self, loan_id: str) -> LoanORM:
        """Approves the loan and generates its EMI schedule (disbursement is
        treated as immediate for this POC - a real system would separate
        approval from disbursement)."""
        loan = await self._require_loan(loan_id)
        if loan.status != "pending":
            raise RuntimeError(f"Loan {loan_id} is not pending (status={loan.status})")

        emi_amount = _calculate_emi(loan.principal_amount, loan.interest_rate, loan.tenure_months)
        start = date.today()
        for i in range(1, loan.tenure_months + 1):
            self.session.add(
                EmiScheduleORM(
                    id=f"{loan.id}-{i:03d}",
                    loan_id=loan.id,
                    installment_number=i,
                    due_date=_add_months(start, i),
                    amount=emi_amount,
                    status="pending",
                )
            )

        loan.status = "active"
        loan.decision_date = date.today()
        await self.session.commit()
        await self.session.refresh(loan, attribute_names=["emi_schedule"])
        return loan

    async def reject_loan(self, loan_id: str, reason: str) -> LoanORM:
        loan = await self._require_loan(loan_id)
        if loan.status != "pending":
            raise RuntimeError(f"Loan {loan_id} is not pending (status={loan.status})")
        loan.status = "rejected"
        loan.decision_date = date.today()
        loan.rejection_reason = reason
        await self.session.commit()
        await self.session.refresh(loan)
        return loan

    async def pay_emi(self, loan_id: str) -> LoanORM:
        """Pays the next pending installment in the loan's EMI schedule.
        Closes the loan once every installment is paid.

        Payment history is the single biggest factor in a real credit score,
        so this now reports itself to credit-service: on-time (paid on or
        before the installment's due_date) nudges the score up, late nudges
        it down harder (matching real-world asymmetry), and fully paying off
        a loan is its own small bonus. Best-effort - if credit-service is
        unreachable the EMI payment itself still succeeds and commits."""
        loan = await self._require_loan(loan_id)
        if loan.status != "active":
            raise RuntimeError(f"Loan {loan_id} is not active (status={loan.status})")
        pending = sorted((e for e in loan.emi_schedule if e.status == "pending"), key=lambda e: e.installment_number)
        if not pending:
            raise RuntimeError(f"Loan {loan_id} has no pending installments")
        installment = pending[0]
        installment.status = "paid"
        just_closed = False
        if all(e.status == "paid" for e in loan.emi_schedule):
            loan.status = "closed"
            just_closed = True
        await self.session.commit()
        await self.session.refresh(loan, attribute_names=["emi_schedule"])

        on_time = installment.due_date >= date.today()
        await record_credit_event(
            customer_id=str(loan.customer_id),
            event_id="CE" + uuid.uuid4().hex[:12].upper(),
            event_type="payment_on_time" if on_time else "payment_missed",
            impact="positive" if on_time else "negative",
            description=(
                f"EMI #{installment.installment_number} for loan {loan_id} paid "
                f"{'on time' if on_time else 'late (due ' + installment.due_date.isoformat() + ')'}"
            ),
        )
        if just_closed:
            await record_credit_event(
                customer_id=str(loan.customer_id),
                event_id="CE" + uuid.uuid4().hex[:12].upper(),
                event_type="loan_paid_off",
                impact="positive",
                description=f"Loan {loan_id} fully repaid",
            )
        return loan

    async def make_extra_payment(self, loan_id: str, amount: float) -> LoanORM:
        """Applies a lump-sum extra payment against the earliest pending
        installments (pays off as many whole installments as the amount
        covers), shortening the remaining tenure. There's no partial-
        installment credit - a real amortization recompute is out of scope
        for this POC's fixed-schedule model."""
        loan = await self._require_loan(loan_id)
        if loan.status != "active":
            raise RuntimeError(f"Loan {loan_id} is not active (status={loan.status})")
        if amount <= 0:
            raise ValueError("amount must be greater than zero")
        pending = sorted((e for e in loan.emi_schedule if e.status == "pending"), key=lambda e: e.installment_number)
        if not pending:
            raise RuntimeError(f"Loan {loan_id} has no pending installments")

        remaining = Decimal(str(amount))
        paid_count = 0
        for installment in pending:
            if remaining < installment.amount:
                break
            installment.status = "paid"
            remaining -= installment.amount
            paid_count += 1

        if paid_count == 0:
            raise RuntimeError(
                f"Extra payment of {amount} is less than one installment amount ({pending[0].amount})"
            )
        if all(e.status == "paid" for e in loan.emi_schedule):
            loan.status = "closed"
        await self.session.commit()
        await self.session.refresh(loan, attribute_names=["emi_schedule"])
        return loan
