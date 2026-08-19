import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import CardRepository
from gql.types import CardType


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def recharge_card(self, info: Info, card_id: str, amount: float) -> CardType:
        repo = CardRepository(info.context["db_session"])
        row = await repo.recharge_card(card_id, amount)
        return mappers.orm_to_card(row)

    @strawberry.mutation
    async def pay_with_card(self, info: Info, card_id: str, amount: float) -> CardType:
        repo = CardRepository(info.context["db_session"])
        row = await repo.pay_with_card(card_id, amount)
        return mappers.orm_to_card(row)
