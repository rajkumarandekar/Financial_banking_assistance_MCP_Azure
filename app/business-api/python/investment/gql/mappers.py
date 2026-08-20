from typing import Dict, Optional

from db.models import HoldingORM, StockPriceORM, StockTransactionORM
from gql.types import HoldingType, StockPriceType, StockTransactionType


def orm_to_price(row: StockPriceORM) -> StockPriceType:
    return StockPriceType(
        symbol=row.symbol,
        companyName=row.company_name,
        price=float(row.price) if row.price is not None else None,
        change=float(row.change) if row.change is not None else None,
        changePercent=float(row.change_percent) if row.change_percent is not None else None,
        volume=row.volume,
        lastRefreshedAt=row.last_refreshed_at.isoformat() if row.last_refreshed_at else None,
        lastError=row.last_error,
    )


def orm_to_holding(row: HoldingORM, prices: Optional[Dict[str, StockPriceORM]] = None) -> HoldingType:
    price_row = (prices or {}).get(row.symbol)
    return HoldingType(
        id=row.id,
        customerId=str(row.customer_id),
        accountId=row.account_id,
        symbol=row.symbol,
        companyName=row.company_name,
        sector=row.sector,
        shares=float(row.shares),
        avgPurchasePrice=float(row.avg_purchase_price),
        currentPrice=float(price_row.price) if price_row and price_row.price is not None else None,
        purchasedAt=row.created_at.isoformat() if row.created_at else None,
    )


def orm_to_transaction(row: StockTransactionORM) -> StockTransactionType:
    return StockTransactionType(
        id=row.id,
        customerId=str(row.customer_id),
        symbol=row.symbol,
        type=row.type,
        shares=float(row.shares),
        price=float(row.price),
        total=float(row.total),
        executedAt=row.executed_at.isoformat(),
    )
