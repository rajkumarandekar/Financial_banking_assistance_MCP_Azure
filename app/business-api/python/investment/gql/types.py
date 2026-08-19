from typing import Optional

import strawberry


@strawberry.type
class StockPriceType:
    symbol: str
    companyName: Optional[str] = None
    price: Optional[float] = None
    change: Optional[float] = None
    changePercent: Optional[float] = None
    volume: Optional[int] = None
    lastRefreshedAt: Optional[str] = None
    lastError: Optional[str] = None


@strawberry.type
class HoldingType:
    id: str
    customerId: str
    accountId: Optional[str] = None
    symbol: str
    companyName: str
    sector: Optional[str] = None
    shares: float
    avgPurchasePrice: float
    currentPrice: Optional[float] = None


@strawberry.type
class StockTransactionType:
    id: str
    customerId: str
    symbol: str
    type: str
    shares: float
    price: float
    total: float
    executedAt: str
