import logging
import uuid
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import HoldingORM, StockPriceORM, StockTransactionORM

logger = logging.getLogger(__name__)


class InvestmentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # --- Reads ---------------------------------------------------------
    async def get_holdings_by_customer(self, customer_id: str) -> List[HoldingORM]:
        stmt = select(HoldingORM).where(HoldingORM.customer_id == uuid.UUID(customer_id))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_transactions_by_customer(self, customer_id: str) -> List[StockTransactionORM]:
        stmt = (
            select(StockTransactionORM)
            .where(StockTransactionORM.customer_id == uuid.UUID(customer_id))
            .order_by(StockTransactionORM.executed_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_prices(self) -> List[StockPriceORM]:
        result = await self.session.execute(select(StockPriceORM))
        return list(result.scalars().all())

    async def get_price(self, symbol: str) -> Optional[StockPriceORM]:
        return await self.session.get(StockPriceORM, symbol)

    async def _require_price(self, symbol: str) -> Decimal:
        row = await self.get_price(symbol)
        if row is None or row.price is None:
            raise RuntimeError(
                f"Price for {symbol} is not available yet - it refreshes automatically every "
                f"few hours, or trigger a manual refresh."
            )
        return row.price

    # --- Trades ----------------------------------------------------------
    async def buy_stock(
        self, customer_id: str, account_id: Optional[str], symbol: str,
        company_name: Optional[str], sector: Optional[str], shares: float,
    ) -> StockTransactionORM:
        if shares <= 0:
            raise ValueError("shares must be greater than zero")
        price_row = await self.get_price(symbol)
        if price_row is None or price_row.price is None:
            raise RuntimeError(
                f"Price for {symbol} is not available yet - it refreshes automatically every "
                f"few hours, or trigger a manual refresh."
            )
        price = price_row.price
        # A known tracked symbol already has a real company name cached from
        # its price row - callers only need to pass one explicitly when
        # buying a symbol that isn't tracked yet.
        if not company_name:
            company_name = price_row.company_name or symbol
        shares_dec = Decimal(str(shares))

        stmt = select(HoldingORM).where(
            HoldingORM.customer_id == uuid.UUID(customer_id), HoldingORM.symbol == symbol
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()

        if existing:
            total_shares = existing.shares + shares_dec
            total_cost = existing.shares * existing.avg_purchase_price + shares_dec * price
            existing.shares = total_shares
            existing.avg_purchase_price = round(total_cost / total_shares, 2)
        else:
            self.session.add(
                HoldingORM(
                    id="hld_" + uuid.uuid4().hex[:12],
                    customer_id=uuid.UUID(customer_id),
                    account_id=account_id,
                    symbol=symbol,
                    company_name=company_name,
                    sector=sector,
                    shares=shares_dec,
                    avg_purchase_price=price,
                )
            )

        txn = StockTransactionORM(
            id="sxn_" + uuid.uuid4().hex[:14],
            customer_id=uuid.UUID(customer_id),
            account_id=account_id,
            symbol=symbol,
            type="buy",
            shares=shares_dec,
            price=price,
            total=round(shares_dec * price, 2),
        )
        self.session.add(txn)
        await self.session.commit()
        await self.session.refresh(txn)
        return txn

    async def sell_stock(self, customer_id: str, symbol: str, shares: float) -> StockTransactionORM:
        if shares <= 0:
            raise ValueError("shares must be greater than zero")
        price = await self._require_price(symbol)
        shares_dec = Decimal(str(shares))

        stmt = select(HoldingORM).where(
            HoldingORM.customer_id == uuid.UUID(customer_id), HoldingORM.symbol == symbol
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing is None or existing.shares < shares_dec:
            owned = existing.shares if existing else Decimal("0")
            raise RuntimeError(f"Cannot sell {shares} shares of {symbol} - only {owned} held")

        remaining = existing.shares - shares_dec
        if remaining <= 0:
            await self.session.delete(existing)
        else:
            existing.shares = remaining

        txn = StockTransactionORM(
            id="sxn_" + uuid.uuid4().hex[:14],
            customer_id=uuid.UUID(customer_id),
            account_id=existing.account_id,
            symbol=symbol,
            type="sell",
            shares=shares_dec,
            price=price,
            total=round(shares_dec * price, 2),
        )
        self.session.add(txn)
        await self.session.commit()
        await self.session.refresh(txn)
        return txn
