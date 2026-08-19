from fastmcp import FastMCP
import logging
import uuid
from typing import Annotated, Optional

import senders
from db.base import get_session_context
from gql import mappers
from gql.repository import CommunicationRepository

logger = logging.getLogger(__name__)
mcp = FastMCP("Communication MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


def _check_self_or_admin(target_customer_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    if caller_customer_id is None or target_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to send/view communications for this customer")


def _new_id() -> str:
    return "COM" + uuid.uuid4().hex[:14].upper()


@mcp.tool(name="sendEmail", description="Send an email to a customer (self, or any customer if admin)")
async def send_email(
    customerId: Annotated[str, "Customer id (UUID)"],
    recipientEmail: Annotated[str, "Recipient email address"],
    subject: Annotated[str, "Email subject"],
    body: Annotated[str, "Email body"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("sendEmail customerId=%s subject=%s", customerId, subject)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    success = senders.send_email_stub(recipientEmail, subject, body)
    async with get_session_context() as session:
        repo = CommunicationRepository(session)
        comm = await repo.record_communication(
            comm_id=_new_id(), customer_id=customerId, channel="email", body=body,
            status="sent" if success else "failed", recipient=recipientEmail, subject=subject,
        )
        return mappers.orm_to_communication(comm)


@mcp.tool(name="sendWhatsapp", description="Send a WhatsApp message to a customer (self, or any customer if admin)")
async def send_whatsapp(
    customerId: Annotated[str, "Customer id (UUID)"],
    recipientPhone: Annotated[str, "Recipient phone number"],
    body: Annotated[str, "Message body"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("sendWhatsapp customerId=%s", customerId)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    success = senders.send_whatsapp_stub(recipientPhone, body)
    async with get_session_context() as session:
        repo = CommunicationRepository(session)
        comm = await repo.record_communication(
            comm_id=_new_id(), customer_id=customerId, channel="whatsapp", body=body,
            status="sent" if success else "failed", recipient=recipientPhone,
        )
        return mappers.orm_to_communication(comm)


@mcp.tool(name="sendNotification", description="Send an in-app notification to a customer (self, or any customer if admin)")
async def send_notification(
    customerId: Annotated[str, "Customer id (UUID)"],
    body: Annotated[str, "Notification body"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("sendNotification customerId=%s", customerId)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    success = senders.send_notification_stub(customerId, body)
    async with get_session_context() as session:
        repo = CommunicationRepository(session)
        comm = await repo.record_communication(
            comm_id=_new_id(), customer_id=customerId, channel="notification", body=body,
            status="sent" if success else "failed",
        )
        return mappers.orm_to_communication(comm)


@mcp.tool(name="getCommunicationHistory", description="Get the communication history for a customer (self, or any customer if admin)")
async def get_communication_history(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = CommunicationRepository(session)
        rows = await repo.get_history(customerId)
        return [mappers.orm_to_communication(row) for row in rows]
