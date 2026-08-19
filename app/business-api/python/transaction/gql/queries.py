from typing import List, Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import TransactionRepository
from gql.types import TransactionType


@strawberry.type
class Query:
    @strawberry.field
    async def transactions_by_recipient_name(self, info: Info, account_id: str, recipient_name: str) -> List[TransactionType]:
        repo = TransactionRepository(info.context["db_session"])
        rows = await repo.get_transactions_by_recipient_name(account_id, recipient_name)
        return [mappers.orm_to_transaction(row) for row in rows]

    @strawberry.field
    async def last_transactions(self, info: Info, account_id: str, limit: int = 5) -> List[TransactionType]:
        repo = TransactionRepository(info.context["db_session"])
        rows = await repo.get_last_transactions(account_id, limit=limit)
        return [mappers.orm_to_transaction(row) for row in rows]

    @strawberry.field
    async def card_transactions(self, info: Info, account_id: str, card_id: str) -> List[TransactionType]:
        repo = TransactionRepository(info.context["db_session"])
        rows = await repo.get_transactions_by_type(account_id, card_id=card_id)
        return [mappers.orm_to_transaction(row) for row in rows]
