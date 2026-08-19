from typing import List

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import CommunicationRepository
from gql.types import CommunicationType


@strawberry.type
class Query:
    @strawberry.field
    async def communication_history(self, info: Info, customer_id: str) -> List[CommunicationType]:
        repo = CommunicationRepository(info.context["db_session"])
        rows = await repo.get_history(customer_id)
        return [mappers.orm_to_communication(row) for row in rows]
