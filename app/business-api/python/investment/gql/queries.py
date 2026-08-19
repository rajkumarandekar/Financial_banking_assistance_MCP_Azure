from typing import List

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import InvestmentRepository
from gql.types import HoldingType, StockPriceType, StockTransactionType


@strawberry.type
class Query:
    @strawberry.field
    async def holdings_by_customer(self, info: Info, customer_id: str) -> List[HoldingType]:
        repo = InvestmentRepository(info.context["db_session"])
        holdings = await repo.get_holdings_by_customer(customer_id)
        prices = {p.symbol: p for p in await repo.get_prices()}
        return [mappers.orm_to_holding(h, prices) for h in holdings]

    @strawberry.field
    async def stock_prices(self, info: Info) -> List[StockPriceType]:
        repo = InvestmentRepository(info.context["db_session"])
        rows = await repo.get_prices()
        return [mappers.orm_to_price(r) for r in rows]

    @strawberry.field
    async def transactions_by_customer(self, info: Info, customer_id: str) -> List[StockTransactionType]:
        repo = InvestmentRepository(info.context["db_session"])
        rows = await repo.get_transactions_by_customer(customer_id)
        return [mappers.orm_to_transaction(r) for r in rows]
