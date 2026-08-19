from typing import List, Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import CreditRepository
from gql.types import CreditHistoryEventType, CreditScoreType


@strawberry.type
class Query:
    @strawberry.field
    async def credit_score(self, info: Info, customer_id: str) -> Optional[CreditScoreType]:
        repo = CreditRepository(info.context["db_session"])
        row = await repo.get_credit_score(customer_id)
        return mappers.orm_to_credit_score(row) if row else None

    @strawberry.field
    async def credit_history(self, info: Info, customer_id: str) -> List[CreditHistoryEventType]:
        repo = CreditRepository(info.context["db_session"])
        rows = await repo.get_credit_history(customer_id)
        return [mappers.orm_to_credit_history_event(row) for row in rows]
