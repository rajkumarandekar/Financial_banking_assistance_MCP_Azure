from typing import Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import InvestmentRepository
from gql.types import StockTransactionType
from price_refresh import refresh_all_prices


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def buy_stock(
        self, info: Info, customer_id: str, symbol: str, shares: float,
        company_name: Optional[str] = None, account_id: Optional[str] = None, sector: Optional[str] = None,
    ) -> StockTransactionType:
        repo = InvestmentRepository(info.context["db_session"])
        row = await repo.buy_stock(customer_id, account_id, symbol, company_name, sector, shares)
        return mappers.orm_to_transaction(row)

    @strawberry.mutation
    async def sell_stock(self, info: Info, customer_id: str, symbol: str, shares: float) -> StockTransactionType:
        repo = InvestmentRepository(info.context["db_session"])
        row = await repo.sell_stock(customer_id, symbol, shares)
        return mappers.orm_to_transaction(row)

    @strawberry.mutation
    async def refresh_prices(self, info: Info) -> int:
        """On-demand refresh, on top of the automatic background timer -
        still goes through the same Alpha Vantage remote MCP call + cache,
        so it's still bounded by the free-tier rate limit either way."""
        return await refresh_all_prices()
