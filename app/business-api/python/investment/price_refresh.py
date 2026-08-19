"""Calls Alpha Vantage's official remote MCP server
(https://mcp.alphavantage.co/mcp) as an MCP client to refresh every tracked
symbol's quote, and caches the result in stock_prices.

This is a real third-party MCP server (confirmed: alphavantage/alpha_vantage_mcp
on GitHub), not one we host - fastmcp.Client can connect to it directly over
HTTP the same way it connects to any MCP server.

Free tier is rate-limited to 25 requests/day, so this is called on a timer
(REFRESH_INTERVAL_HOURS, a few times a day) plus on-demand via the
refreshPrices mutation/REST call - never per page-load. With ~8 tracked
symbols, once every 6 hours uses 32 requests/day at 4x refreshes... that's
already over budget, so the default below is deliberately conservative
(every 8 hours = 3x/day = 24 requests/day, just under the limit) if the
symbol list stays at 8. Adjust REFRESH_INTERVAL_HOURS if more symbols get
tracked.
"""
import asyncio
import csv
import io
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastmcp import Client
from sqlalchemy import select

from db.base import get_session_factory
from db.models import StockPriceORM

logger = logging.getLogger(__name__)

ALPHA_VANTAGE_MCP_URL = "https://mcp.alphavantage.co/mcp"
REFRESH_INTERVAL_HOURS = 8


def _api_key() -> Optional[str]:
    return os.environ.get("ALPHA_VANTAGE_API_KEY")


def _parse_global_quote(raw) -> Optional[dict]:
    """The Alpha Vantage MCP server's GLOBAL_QUOTE tool does NOT return the
    classic REST {"Global Quote": {"05. price": ...}} JSON shape - confirmed
    by a real live call, it returns {"result": "<CSV string>"} with header
    row "symbol,open,high,low,price,volume,latestDay,previousClose,change,
    changePercent" and one data row. Parse that CSV directly rather than
    guessing at a JSON shape that doesn't match what the server actually sends."""
    csv_text = None
    if isinstance(raw, dict):
        csv_text = raw.get("result")
    elif isinstance(raw, str):
        csv_text = raw

    if not csv_text or not isinstance(csv_text, str):
        return None

    try:
        reader = csv.DictReader(io.StringIO(csv_text))
        row = next(reader, None)
    except csv.Error:
        return None
    return row or None


def _decimal_or_none(value) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value).replace("%", ""))
    except (InvalidOperation, ValueError):
        return None


async def refresh_symbol(client: Client, symbol: str, exchange_symbol: str) -> dict:
    """Fetches one symbol's quote and returns a dict of fields to persist -
    never raises, so one bad symbol can't abort the whole refresh batch."""
    try:
        result = await client.call_tool("GLOBAL_QUOTE", {"symbol": exchange_symbol})
        raw = getattr(result, "data", None) or getattr(result, "structured_content", None)
        if raw is None and getattr(result, "content", None):
            text_blocks = [b.text for b in result.content if getattr(b, "type", None) == "text"]
            raw = "\n".join(text_blocks) if text_blocks else None
        quote = _parse_global_quote(raw)
        if not quote:
            return {"symbol": symbol, "last_error": "No quote data returned"}

        price = _decimal_or_none(quote.get("price"))
        if price is None:
            # Got a response, but it wasn't a real quote row (rate-limit
            # notice, unknown symbol, etc.) - don't silently mark this
            # "refreshed" with a null price.
            return {"symbol": symbol, "last_error": f"Unrecognized response: {str(quote)[:300]}"}

        return {
            "symbol": symbol,
            "price": price,
            "change": _decimal_or_none(quote.get("change")),
            "change_percent": _decimal_or_none(quote.get("changePercent")),
            "volume": int(quote["volume"]) if quote.get("volume") else None,
            "last_refreshed_at": datetime.now(timezone.utc),
            "last_error": None,
        }
    except Exception as exc:  # noqa: BLE001 - one symbol's failure must not break the batch
        logger.warning("Price refresh failed for %s (%s): %s", symbol, exchange_symbol, exc)
        return {"symbol": symbol, "last_error": str(exc)[:500]}


async def refresh_all_prices() -> int:
    """Refreshes every tracked symbol. Returns the count successfully updated."""
    api_key = _api_key()
    if not api_key:
        logger.warning("ALPHA_VANTAGE_API_KEY not set - skipping price refresh")
        return 0

    session_factory = get_session_factory()
    async with session_factory() as session:
        rows = (await session.execute(select(StockPriceORM))).scalars().all()
        symbols = [(r.symbol, r.exchange_symbol) for r in rows]

        if not symbols:
            return 0

        updated = 0
        async with Client(f"{ALPHA_VANTAGE_MCP_URL}?apikey={api_key}") as client:
            for i, (symbol, exchange_symbol) in enumerate(symbols):
                if i > 0:
                    # Firing requests back-to-back intermittently got empty
                    # responses back for otherwise-valid symbols (confirmed
                    # live: HDFCBANK.BSE/INFY.BSE failed in a tight batch but
                    # succeeded every time when spaced out) - a gap between
                    # calls helps a lot, though the free tier still isn't
                    # 100% reliable even spaced out. A failed refresh keeps
                    # the last known-good price rather than blanking it.
                    await asyncio.sleep(2.5)
                patch = await refresh_symbol(client, symbol, exchange_symbol)
                row = await session.get(StockPriceORM, symbol)
                if row is None:
                    continue
                for field, value in patch.items():
                    if field == "symbol":
                        continue
                    setattr(row, field, value)
                if patch.get("price") is not None:
                    updated += 1

        await session.commit()
    logger.info("Price refresh complete: %d/%d symbols updated", updated, len(symbols))
    return updated


async def refresh_loop() -> None:
    """Background loop started from the FastAPI lifespan - refreshes once at
    startup, then every REFRESH_INTERVAL_HOURS."""
    while True:
        try:
            await refresh_all_prices()
        except Exception:  # noqa: BLE001 - the loop must survive a bad refresh cycle
            logger.exception("Unhandled error in price refresh loop")
        await asyncio.sleep(REFRESH_INTERVAL_HOURS * 3600)
