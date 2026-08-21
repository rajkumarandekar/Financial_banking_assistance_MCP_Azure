from fastmcp import FastMCP
import logging
from typing import Annotated, Optional

from db.base import get_session_context
from gql import mappers
from gql.repository import InvestmentRepository
from price_refresh import refresh_all_prices

logger = logging.getLogger(__name__)
mcp = FastMCP("Investment MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


def _check_self_or_admin(target_customer_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    if caller_customer_id is None or target_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to access this customer's portfolio")


@mcp.tool(name="getHoldings", description="Get all stock holdings for a customer (self, or any customer if admin)")
async def get_holdings(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getHoldings customerId=%s", customerId)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = InvestmentRepository(session)
        rows = await repo.get_holdings_by_customer(customerId)
        prices = {p.symbol: p for p in await repo.get_prices()}
        return [mappers.orm_to_holding(r, prices) for r in rows]


@mcp.tool(name="getStockPrices", description="Get the latest cached prices for all tracked stock symbols")
async def get_stock_prices(
    # Not customer-scoped (prices are the same for everyone), but every MCP
    # tool in this system still accepts these two - the backend's
    # IdentityInjectingMCPTool sends them on every call unconditionally, and
    # a tool that doesn't declare them fails schema validation before it
    # even runs (confirmed live: "Unexpected keyword argument" errors on
    # both params the moment this tool was first wired to an agent).
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getStockPrices")
    async with get_session_context() as session:
        repo = InvestmentRepository(session)
        rows = await repo.get_prices()
        return [mappers.orm_to_price(r) for r in rows]


@mcp.tool(name="buyStock", description="Buy shares of a stock for a customer (self, or on behalf of any customer if admin)")
async def buy_stock(
    customerId: Annotated[str, "Customer id (UUID)"],
    symbol: Annotated[str, "Stock ticker symbol, e.g. RELIANCE"],
    shares: Annotated[float, "Number of shares to buy"],
    companyName: Annotated[Optional[str], "Company display name - only needed for a symbol not already tracked"] = None,
    accountId: Annotated[Optional[str], "Account to record the trade against"] = None,
    sector: Annotated[Optional[str], "Sector, e.g. Technology"] = None,
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("buyStock customerId=%s symbol=%s shares=%s", customerId, symbol, shares)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = InvestmentRepository(session)
        row = await repo.buy_stock(customerId, accountId, symbol, companyName, sector, shares)
        return mappers.orm_to_transaction(row)


@mcp.tool(name="sellStock", description="Sell shares of a stock for a customer (self, or on behalf of any customer if admin)")
async def sell_stock(
    customerId: Annotated[str, "Customer id (UUID)"],
    symbol: Annotated[str, "Stock ticker symbol, e.g. RELIANCE"],
    shares: Annotated[float, "Number of shares to sell"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("sellStock customerId=%s symbol=%s shares=%s", customerId, symbol, shares)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = InvestmentRepository(session)
        row = await repo.sell_stock(customerId, symbol, shares)
        return mappers.orm_to_transaction(row)


@mcp.tool(name="getStockTransactions", description="Get a customer's stock buy/sell trade history (self, or any customer if admin) - not banking transactions, this is trade history only")
async def get_stock_transactions(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getStockTransactions customerId=%s", customerId)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = InvestmentRepository(session)
        rows = await repo.get_transactions_by_customer(customerId)
        return [mappers.orm_to_transaction(r) for r in rows]


@mcp.tool(name="refreshStockPrices", description="Force an on-demand refresh of all tracked stock prices from Alpha Vantage")
async def refresh_stock_prices(
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("refreshStockPrices (manual trigger)")
    updated = await refresh_all_prices()
    return {"updated": updated}
