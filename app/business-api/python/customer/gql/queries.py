from typing import List, Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import CustomerRepository
from gql.types import CustomerType


@strawberry.type
class Query:
    @strawberry.field
    async def customer_profile(self, info: Info, customer_id: str) -> Optional[CustomerType]:
        repo = CustomerRepository(info.context["db_session"])
        row = await repo.get_customer_by_id(customer_id)
        return mappers.orm_to_customer(row) if row else None

    @strawberry.field
    async def customer_by_email(self, info: Info, email: str) -> Optional[CustomerType]:
        repo = CustomerRepository(info.context["db_session"])
        row = await repo.get_customer_by_email(email)
        return mappers.orm_to_customer(row) if row else None

    @strawberry.field
    async def search_customers(self, info: Info, query: str) -> List[CustomerType]:
        repo = CustomerRepository(info.context["db_session"])
        rows = await repo.search_customers(query)
        return [mappers.orm_to_customer(row) for row in rows]
