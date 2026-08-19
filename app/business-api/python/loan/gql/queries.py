from typing import List, Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import LoanRepository
from gql.types import LoanType


@strawberry.type
class Query:
    @strawberry.field
    async def loans_by_customer(self, info: Info, customer_id: str) -> List[LoanType]:
        repo = LoanRepository(info.context["db_session"])
        rows = await repo.get_loans_by_customer(customer_id)
        return [mappers.orm_to_loan(row, include_schedule=True) for row in rows]

    @strawberry.field
    async def all_loans(self, info: Info) -> List[LoanType]:
        repo = LoanRepository(info.context["db_session"])
        rows = await repo.get_all_loans()
        return [mappers.orm_to_loan(row) for row in rows]

    @strawberry.field
    async def loan_details(self, info: Info, loan_id: str) -> Optional[LoanType]:
        repo = LoanRepository(info.context["db_session"])
        row = await repo.get_loan_details(loan_id)
        return mappers.orm_to_loan(row, include_schedule=True) if row else None
