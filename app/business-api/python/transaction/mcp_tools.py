from fastmcp import FastMCP
import logging
from typing import Annotated, Optional

from account_service_client import get_account_customer_id
from db.base import get_session_context
from gql import mappers
from gql.repository import TransactionRepository

logger = logging.getLogger(__name__)
mcp = FastMCP("Transaction MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


async def _check_account_ownership(account_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    owner_customer_id = await get_account_customer_id(account_id)
    if owner_customer_id is None:
        # account-service unreachable/unknown account - fail closed, not open.
        raise PermissionError("Unable to verify account ownership")
    if caller_customer_id is None or owner_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to access this account's transactions")


@mcp.tool(name="getTransactionsByRecipientName", description="Get transactions by recipient name")
async def get_transactions_by_recipient_name(
    accountId: Annotated[str, "Unique identifier for the user account"],
    recipientName: Annotated[str, "Recipient name to filter by"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getTransactionsByRecipientName accountId=%s recipientName=%s", accountId, recipientName)
    await _check_account_ownership(accountId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = TransactionRepository(session)
        rows = await repo.get_transactions_by_recipient_name(accountId, recipientName)
        return [mappers.orm_to_transaction(row) for row in rows]


@mcp.tool(name="getCardTransactions", description="Get credit and debit card transactions")
async def get_card_transactions(
    accountId: Annotated[str, "Unique identifier for the user account"],
    cardId: Annotated[str, "Unique identifier for the card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getCardTransactions accountId=%s cardId=%s", accountId, cardId)
    await _check_account_ownership(accountId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = TransactionRepository(session)
        rows = await repo.get_transactions_by_type(accountId, card_id=cardId)
        return [mappers.orm_to_transaction(row) for row in rows]


@mcp.tool(name="getLastTransactions", description="Get the last transactions for an account")
async def get_last_transactions(
    accountId: Annotated[str, "Unique identifier for the user account"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getLastTransactions accountId=%s", accountId)
    await _check_account_ownership(accountId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = TransactionRepository(session)
        rows = await repo.get_last_transactions(accountId)
        return [mappers.orm_to_transaction(row) for row in rows]
