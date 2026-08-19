from fastmcp import FastMCP
import logging
from typing import Annotated, Optional

from db.base import get_session_context
from gql import mappers
from gql.repository import CustomerRepository

logger = logging.getLogger(__name__)
mcp = FastMCP("Customer MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


def _check_self_or_admin(target_customer_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    if caller_customer_id is None or target_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to access this customer's data")


@mcp.tool(name="getCustomerProfile", description="Get a customer's profile (self, or any customer if admin)")
async def get_customer_profile(
    customerId: Annotated[str, "Unique identifier (UUID) of the customer"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getCustomerProfile called with customerId=%s callerRole=%s", customerId, callerRole)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = CustomerRepository(session)
        row = await repo.get_customer_by_id(customerId)
        return mappers.orm_to_customer(row) if row else None


@mcp.tool(name="searchCustomers", description="Search customers by name/email substring (admin only)")
async def search_customers(
    query: Annotated[str, "Search text matched against customer name/email"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("searchCustomers called with query=%s callerRole=%s", query, callerRole)
    if callerRole != "admin":
        raise PermissionError("Only admin may search customers")
    async with get_session_context() as session:
        repo = CustomerRepository(session)
        rows = await repo.search_customers(query)
        return [mappers.orm_to_customer(row) for row in rows]


@mcp.tool(name="updateContactDetails", description="Update a customer's phone/full name (self, or any customer if admin)")
async def update_contact_details(
    customerId: Annotated[str, "Unique identifier (UUID) of the customer"],
    phone: Annotated[Optional[str], "New phone number"] = None,
    fullName: Annotated[Optional[str], "New full name"] = None,
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("updateContactDetails called with customerId=%s callerRole=%s", customerId, callerRole)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = CustomerRepository(session)
        row = await repo.update_contact_details(customerId, phone=phone, full_name=fullName)
        return mappers.orm_to_customer(row)
