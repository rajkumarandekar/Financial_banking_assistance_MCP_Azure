from typing import List, Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import PaymentRepository
from gql.types import PaymentType


@strawberry.type
class Query:
    @strawberry.field
    async def payment_details(self, info: Info, payment_id: str) -> Optional[PaymentType]:
        repo = PaymentRepository(info.context["db_session"])
        row = await repo.get_payment(payment_id)
        return mappers.orm_to_payment(row) if row else None

    @strawberry.field
    async def payments_by_customer(self, info: Info, customer_id: str) -> List[PaymentType]:
        repo = PaymentRepository(info.context["db_session"])
        rows = await repo.get_payments_by_customer(customer_id)
        return [mappers.orm_to_payment(row) for row in rows]
