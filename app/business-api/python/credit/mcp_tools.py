from fastmcp import FastMCP
import logging
from typing import Annotated, Optional

from db.base import get_session_context
from gql import mappers
from gql.repository import CreditRepository

logger = logging.getLogger(__name__)
mcp = FastMCP("Credit MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


def _check_self_or_admin(target_customer_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    if caller_customer_id is None or target_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to access this customer's credit information")


@mcp.tool(name="getCreditScore", description="Get a customer's current credit score (self, or any customer if admin)")
async def get_credit_score(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getCreditScore customerId=%s callerRole=%s", customerId, callerRole)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = CreditRepository(session)
        row = await repo.get_credit_score(customerId)
        return mappers.orm_to_credit_score(row) if row else None


@mcp.tool(name="getCreditHistory", description="Get a customer's credit history events (self, or any customer if admin)")
async def get_credit_history(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getCreditHistory customerId=%s callerRole=%s", customerId, callerRole)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = CreditRepository(session)
        rows = await repo.get_credit_history(customerId)
        return [mappers.orm_to_credit_history_event(row) for row in rows]
