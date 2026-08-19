from typing import Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import CustomerRepository
from gql.types import CustomerType


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def update_contact_details(
        self, info: Info, customer_id: str, phone: Optional[str] = None, full_name: Optional[str] = None
    ) -> CustomerType:
        repo = CustomerRepository(info.context["db_session"])
        row = await repo.update_contact_details(customer_id, phone=phone, full_name=full_name)
        return mappers.orm_to_customer(row)
