from typing import Optional

import strawberry


@strawberry.type
class EmiScheduleType:
    id: str
    installmentNumber: int
    dueDate: str
    amount: float
    status: str


@strawberry.type
class LoanType:
    id: str
    customerId: str
    accountId: Optional[str] = None
    loanType: str
    principalAmount: float
    interestRate: float
    tenureMonths: int
    status: str
    appliedDate: Optional[str] = None
    decisionDate: Optional[str] = None
    rejectionReason: Optional[str] = None
    emiSchedule: Optional[list[EmiScheduleType]] = None
