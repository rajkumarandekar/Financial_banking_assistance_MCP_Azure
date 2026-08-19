from typing import Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import LoanRepository
from gql.types import LoanType


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def apply_loan(
        self,
        info: Info,
        customer_id: str,
        loan_type: str,
        principal_amount: float,
        interest_rate: float,
        tenure_months: int,
        account_id: Optional[str] = None,
    ) -> LoanType:
        repo = LoanRepository(info.context["db_session"])
        row = await repo.apply_loan(customer_id, loan_type, principal_amount, interest_rate, tenure_months, account_id)
        return mappers.orm_to_loan(row)

    @strawberry.mutation
    async def approve_loan(self, info: Info, loan_id: str) -> LoanType:
        repo = LoanRepository(info.context["db_session"])
        row = await repo.approve_loan(loan_id)
        return mappers.orm_to_loan(row, include_schedule=True)

    @strawberry.mutation
    async def reject_loan(self, info: Info, loan_id: str, reason: str) -> LoanType:
        repo = LoanRepository(info.context["db_session"])
        row = await repo.reject_loan(loan_id, reason)
        return mappers.orm_to_loan(row)

    @strawberry.mutation
    async def pay_emi(self, info: Info, loan_id: str) -> LoanType:
        repo = LoanRepository(info.context["db_session"])
        row = await repo.pay_emi(loan_id)
        return mappers.orm_to_loan(row, include_schedule=True)

    @strawberry.mutation
    async def make_extra_payment(self, info: Info, loan_id: str, amount: float) -> LoanType:
        repo = LoanRepository(info.context["db_session"])
        row = await repo.make_extra_payment(loan_id, amount)
        return mappers.orm_to_loan(row, include_schedule=True)
