"""POC demo data seed for investment_schema.

Migrates the seed portfolio that used to live only in the frontend's local
simulation (lib/investmentService.ts) into the real database, for
bob.user@contoso.com. currentPrice is never seeded here - stock_prices
starts empty and is populated by the price-refresh job calling the real
Alpha Vantage remote MCP server; until that first refresh runs, holdings
will show no live price (not a fabricated one).

exchange_symbol uses the ".BSE" suffix convention Alpha Vantage documents
for international listings - flagged in README.md as the one thing to
verify/adjust with a real API key once available.

Uses the same customer UUID seeded elsewhere:
  - bob.user@contoso.com -> 22222222-2222-2222-2222-222222222222

Run manually for local dev: `uv run python -m db.seed`
"""

import asyncio
import logging
import uuid
from decimal import Decimal

from sqlalchemy import select

from db.base import get_session_factory
from db.models import HoldingORM, StockPriceORM, StockTransactionORM

logger = logging.getLogger(__name__)

CUSTOMER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
ACCOUNT_ID = "1010"

# (symbol, exchange_symbol, company_name)
# Verified live against the real Alpha Vantage remote MCP server - every
# entry here returns a real quote for ".BSE". TATAMOTORS.BSE was tried and
# returns no data (its only resolvable symbol is "TTM", the US ADR, priced
# in USD - not a substitute for the BSE-listed share) - replaced with WIPRO,
# confirmed working.
TRACKED_SYMBOLS = [
    ("RELIANCE", "RELIANCE.BSE", "Reliance Industries"),
    ("TCS", "TCS.BSE", "Tata Consultancy Services"),
    ("HDFCBANK", "HDFCBANK.BSE", "HDFC Bank"),
    ("INFY", "INFY.BSE", "Infosys"),
    ("ICICIBANK", "ICICIBANK.BSE", "ICICI Bank"),
    ("WIPRO", "WIPRO.BSE", "Wipro"),
    ("SBIN", "SBIN.BSE", "State Bank of India"),
    ("BHARTIARTL", "BHARTIARTL.BSE", "Bharti Airtel"),
]

SEED_HOLDINGS = [
    dict(id="hld_reliance01", symbol="RELIANCE", company_name="Reliance Industries", sector="Energy",
         shares=Decimal("40"), avg_purchase_price=Decimal("2650.00")),
    dict(id="hld_tcs01", symbol="TCS", company_name="Tata Consultancy Services", sector="Technology",
         shares=Decimal("15"), avg_purchase_price=Decimal("4250.00")),
    dict(id="hld_hdfcbank01", symbol="HDFCBANK", company_name="HDFC Bank", sector="Banking",
         shares=Decimal("60"), avg_purchase_price=Decimal("1510.00")),
    dict(id="hld_infy01", symbol="INFY", company_name="Infosys", sector="Technology",
         shares=Decimal("25"), avg_purchase_price=Decimal("1720.00")),
    dict(id="hld_icicibank01", symbol="ICICIBANK", company_name="ICICI Bank", sector="Banking",
         shares=Decimal("35"), avg_purchase_price=Decimal("1340.00")),
]

SEED_TRANSACTIONS = [
    dict(id="sxn_reliance01", symbol="RELIANCE", type="buy", shares=Decimal("40"), price=Decimal("2650.00"), total=Decimal("106000.00")),
    dict(id="sxn_tcs01", symbol="TCS", type="buy", shares=Decimal("15"), price=Decimal("4250.00"), total=Decimal("63750.00")),
    dict(id="sxn_hdfcbank01", symbol="HDFCBANK", type="buy", shares=Decimal("60"), price=Decimal("1510.00"), total=Decimal("90600.00")),
    dict(id="sxn_infy01", symbol="INFY", type="buy", shares=Decimal("25"), price=Decimal("1720.00"), total=Decimal("43000.00")),
    dict(id="sxn_icicibank01", symbol="ICICIBANK", type="buy", shares=Decimal("35"), price=Decimal("1340.00"), total=Decimal("46900.00")),
]


async def seed() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        existing_holding_ids = set((await session.execute(select(HoldingORM.id))).scalars().all())
        existing_txn_ids = set((await session.execute(select(StockTransactionORM.id))).scalars().all())
        existing_symbols = set((await session.execute(select(StockPriceORM.symbol))).scalars().all())

        new_holdings = [
            HoldingORM(customer_id=CUSTOMER_ID, account_id=ACCOUNT_ID, **h)
            for h in SEED_HOLDINGS if h["id"] not in existing_holding_ids
        ]
        new_txns = [
            StockTransactionORM(customer_id=CUSTOMER_ID, account_id=ACCOUNT_ID, **t)
            for t in SEED_TRANSACTIONS if t["id"] not in existing_txn_ids
        ]
        new_prices = [
            StockPriceORM(symbol=symbol, exchange_symbol=exch, company_name=name)
            for symbol, exch, name in TRACKED_SYMBOLS if symbol not in existing_symbols
        ]

        session.add_all(new_holdings)
        session.add_all(new_txns)
        session.add_all(new_prices)
        await session.commit()
    logger.info(
        f"Seed data inserted: {len(new_holdings)} holdings, {len(new_txns)} transactions, "
        f"{len(new_prices)} tracked symbols (prices empty until first refresh)"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
