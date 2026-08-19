from typing import Optional

from db.models import EmiScheduleORM, LoanORM
from gql.types import EmiScheduleType, LoanType


def orm_to_emi(row: EmiScheduleORM) -> EmiScheduleType:
    return EmiScheduleType(
        id=row.id,
        installmentNumber=row.installment_number,
        dueDate=row.due_date.isoformat(),
        amount=float(row.amount),
        status=row.status,
    )


def orm_to_loan(row: LoanORM, include_schedule: bool = False) -> LoanType:
    return LoanType(
        id=row.id,
        customerId=str(row.customer_id),
        accountId=row.account_id,
        loanType=row.loan_type,
        principalAmount=float(row.principal_amount),
        interestRate=float(row.interest_rate),
        tenureMonths=row.tenure_months,
        status=row.status,
        appliedDate=row.applied_date.isoformat() if row.applied_date else None,
        decisionDate=row.decision_date.isoformat() if row.decision_date else None,
        rejectionReason=row.rejection_reason,
        emiSchedule=[orm_to_emi(e) for e in row.emi_schedule] if include_schedule else None,
    )
