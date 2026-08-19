from typing import List, Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import AccountRepository, CardRepository
from gql.types import AccountType, BeneficiaryType, CardType


@strawberry.type
class Query:
    @strawberry.field
    async def accounts_by_user_name(self, info: Info, user_name: str) -> List[AccountType]:
        repo = AccountRepository(info.context["db_session"])
        rows = await repo.get_accounts_by_user_name(user_name)
        return [mappers.orm_to_account(row) for row in rows]

    @strawberry.field
    async def account_details(self, info: Info, account_id: str) -> Optional[AccountType]:
        repo = AccountRepository(info.context["db_session"])
        row = await repo.get_account_details(account_id)
        return mappers.orm_to_account(row) if row else None

    @strawberry.field
    async def registered_beneficiaries(self, info: Info, account_id: str) -> List[BeneficiaryType]:
        repo = AccountRepository(info.context["db_session"])
        rows = await repo.get_registered_beneficiary(account_id)
        return [mappers.orm_to_beneficiary(row) for row in rows]

    @strawberry.field
    async def credit_cards(self, info: Info, account_id: str) -> List[CardType]:
        repo = CardRepository(info.context["db_session"])
        rows = await repo.get_credit_cards(account_id)
        return [mappers.orm_to_card(row) for row in rows]

    @strawberry.field
    async def card_details(self, info: Info, card_id: str) -> Optional[CardType]:
        repo = CardRepository(info.context["db_session"])
        row = await repo.get_card_details(card_id)
        return mappers.orm_to_card(row) if row else None
