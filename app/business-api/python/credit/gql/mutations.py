from typing import Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import CreditRepository
from gql.types import CreditHistoryEventType


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def record_credit_event(
        self, info: Info, customer_id: str, event_id: str, event_type: str, impact: str, description: Optional[str] = None
    ) -> CreditHistoryEventType:
        repo = CreditRepository(info.context["db_session"])
        row = await repo.record_credit_event(customer_id, event_id, event_type, description, impact)
        return mappers.orm_to_credit_history_event(row)
