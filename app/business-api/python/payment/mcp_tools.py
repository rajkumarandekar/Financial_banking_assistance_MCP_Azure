from fastmcp import FastMCP
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from account_service_client import get_account_customer_id
from db.base import get_session_context
from gql import mappers
from gql.repository import PaymentRepository
from transaction_service_client import notify_transaction

logger = logging.getLogger(__name__)
mcp = FastMCP("Payment MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


async def _resolve_and_check_account_ownership(account_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> str:
    """Returns the account's real owning customer_id after verifying the caller
    is allowed to pay from it (self, or admin). Fails closed if account-service
    is unreachable - same policy as transaction-service's ownership check."""
    owner_customer_id = await get_account_customer_id(account_id)
    if owner_customer_id is None:
        raise PermissionError("Unable to verify account ownership")
    if caller_role != "admin" and (caller_customer_id is None or owner_customer_id != caller_customer_id):
        raise PermissionError("Not authorized to pay from this account")
    return owner_customer_id


def _check_payment_ownership(payment_customer_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    if caller_customer_id is None or payment_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to access this payment")


@mcp.tool(name="processPayment", description="Submit a payment request")
async def process_payment(
    account_id: Annotated[str, "Unique identifier for the account making the payment"],
    amount: Annotated[float, "Payment amount in the account's currency"],
    description: Annotated[str, "Description or purpose of the payment"],
    timestamp: Annotated[str, "ISO timestamp when the payment was initiated"],
    recipient_name: Annotated[Optional[str], "Name of the payment recipient"] = None,
    recipient_bank_code: Annotated[Optional[str], "Bank code or routing number for the recipient"] = None,
    payment_type: Annotated[Optional[str], "Type of payment: BankTransfer, DirectDebit, CreditCard"] = None,
    card_id: Annotated[Optional[str], "Identifier for the card id used in payment when paymentType is CreditCard"] = None,
    category: Annotated[Optional[str], "Category of the payment"] = None,
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("processPayment called with account_id=%s, amount=%s, description=%s", account_id, amount, description)

    if not account_id or not account_id.isdigit():
        raise ValueError("AccountId is empty or not a valid number")
    if (payment_type or "").lower() == "creditcard" and not card_id:
        raise ValueError("Credit card id is empty or null for payment type CreditCard")

    owner_customer_id = await _resolve_and_check_account_ownership(account_id, callerCustomerId, callerRole)

    async with get_session_context() as session:
        repo = PaymentRepository(session)
        payment = await repo.create_payment(
            payment_id="PAY" + uuid.uuid4().hex[:12].upper(),
            customer_id=owner_customer_id,
            account_id=account_id,
            description=description,
            amount=amount,
            recipient_name=recipient_name,
            recipient_bank_code=recipient_bank_code,
            payment_type=payment_type,
            card_id=card_id,
            category=category,
        )

        # The transaction record's status used to be an LLM-supplied guess
        # ("BankTransfer -> pending", "CreditCard -> paid") that was never
        # updated afterward - confirmed live that this caused
        # transaction.status to permanently disagree with the real
        # payment.status (payment showed "paid", transaction stayed
        # "pending" forever). A transaction only gets created here because
        # notify_transaction just succeeded, so "paid" is the only status
        # that's ever actually true for it - hardcoded, not guessed.
        transaction_id = await notify_transaction(
            account_id=account_id,
            description=description,
            payment_type=payment_type,
            amount=amount,
            timestamp=timestamp,
            recipient_name=recipient_name,
            recipient_bank_code=recipient_bank_code,
            card_id=card_id,
            category=category,
            status="paid",
        )

        if transaction_id is not None:
            payment = await repo.mark_paid(payment.id, transaction_id)
        else:
            # Unlike the pre-migration REST version, a failed notification is
            # NOT silently swallowed - the payment record reflects the real
            # outcome so getPaymentStatus/retryPayment can act on it.
            payment = await repo.mark_failed(payment.id, "Failed to record transaction in transaction-service")

        return mappers.orm_to_payment(payment)


@mcp.tool(name="getPaymentsByCustomer", description="List all payments for a customer (self, or any customer if admin) - use this for payment history, pending payments, status breakdowns, or 'how much have I paid' style questions")
async def get_payments_by_customer(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getPaymentsByCustomer customerId=%s callerRole=%s", customerId, callerRole)
    if callerRole != "admin" and (callerCustomerId is None or customerId != callerCustomerId):
        raise PermissionError("Not authorized to access this customer's payments")
    async with get_session_context() as session:
        repo = PaymentRepository(session)
        rows = await repo.get_payments_by_customer(customerId)
        return [mappers.orm_to_payment(row) for row in rows]


@mcp.tool(
    name="getPaymentSummary",
    description=(
        "Get a pre-computed, exact breakdown of a customer's payments by status (counts and total paid "
        "amount) - use this instead of getPaymentsByCustomer for any 'how many'/'how much'/status-breakdown "
        "question, since counting a long list yourself is unreliable. Pass fromDate/toDate (YYYY-MM-DD, "
        "inclusive) to scope this to a period - e.g. for 'this month' pass the 1st of the current month as "
        "fromDate. The filtering and summing both happen here, not in your own reasoning: hand-filtering and "
        "summing a subset of a long list yourself is exactly as unreliable as hand-counting the whole list. "
        "Only fetch the full list via getPaymentsByCustomer when you need individual payment details (ids, "
        "recipients, dates)."
    ),
)
async def get_payment_summary(
    customerId: Annotated[str, "Customer id (UUID)"],
    fromDate: Annotated[Optional[str], "Inclusive start date (YYYY-MM-DD) to scope the summary to a period"] = None,
    toDate: Annotated[Optional[str], "Inclusive end date (YYYY-MM-DD) to scope the summary to a period"] = None,
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info(
        "getPaymentSummary customerId=%s callerRole=%s fromDate=%s toDate=%s",
        customerId, callerRole, fromDate, toDate,
    )
    if callerRole != "admin" and (callerCustomerId is None or customerId != callerCustomerId):
        raise PermissionError("Not authorized to access this customer's payments")
    async with get_session_context() as session:
        repo = PaymentRepository(session)
        rows = await repo.get_payments_by_customer(customerId)

    if fromDate:
        from_dt = datetime.fromisoformat(fromDate).replace(tzinfo=timezone.utc)
        rows = [r for r in rows if r.created_at and r.created_at >= from_dt]
    if toDate:
        to_dt = datetime.fromisoformat(toDate).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        rows = [r for r in rows if r.created_at and r.created_at <= to_dt]

    # Counted here, in code, not left for the model to tally from a raw list -
    # confirmed live that the model miscounted a genuine 82-payment list as 93
    # when asked to summarize it itself, and separately (before fromDate/toDate
    # existed) undercounted an August-only total by ~20x (reported ~$7,762 when
    # the real total was ~169,625) after hand-filtering+summing a date range
    # itself from the raw getPaymentsByCustomer list.
    counts: dict[str, int] = {}
    total_paid = 0.0
    for row in rows:
        counts[row.status] = counts.get(row.status, 0) + 1
        if row.status == "paid":
            total_paid += float(row.amount)

    return {
        "totalPayments": len(rows),
        "countsByStatus": counts,
        "totalPaidAmount": round(total_paid, 2),
        "fromDate": fromDate,
        "toDate": toDate,
    }


@mcp.tool(name="getPaymentStatus", description="Get the current status of a single payment by its id")
async def get_payment_status(
    paymentId: Annotated[str, "Unique identifier for the payment"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    async with get_session_context() as session:
        repo = PaymentRepository(session)
        payment = await repo.get_payment(paymentId)
        if payment is None:
            return None
        _check_payment_ownership(str(payment.customer_id), callerCustomerId, callerRole)
        return mappers.orm_to_payment(payment)


@mcp.tool(name="cancelPayment", description="Cancel a payment that is still processing/pending")
async def cancel_payment(
    paymentId: Annotated[str, "Unique identifier for the payment"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    async with get_session_context() as session:
        repo = PaymentRepository(session)
        payment = await repo.get_payment(paymentId)
        if payment is None:
            raise RuntimeError(f"Payment {paymentId} not found")
        _check_payment_ownership(str(payment.customer_id), callerCustomerId, callerRole)
        updated = await repo.cancel_payment(paymentId)
        return mappers.orm_to_payment(updated)


@mcp.tool(name="retryPayment", description="Retry a payment that previously failed")
async def retry_payment(
    paymentId: Annotated[str, "Unique identifier for the payment"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    async with get_session_context() as session:
        repo = PaymentRepository(session)
        payment = await repo.get_payment(paymentId)
        if payment is None:
            raise RuntimeError(f"Payment {paymentId} not found")
        _check_payment_ownership(str(payment.customer_id), callerCustomerId, callerRole)
        if payment.status != "failed":
            raise RuntimeError(f"Payment {paymentId} is not in a failed state (status={payment.status})")

        import datetime

        transaction_id = await notify_transaction(
            account_id=payment.account_id,
            description=payment.description,
            payment_type=payment.payment_type,
            amount=float(payment.amount),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            recipient_name=payment.recipient_name,
            recipient_bank_code=payment.recipient_bank_code,
            card_id=payment.card_id,
            category=payment.category,
            status="paid",
        )

        if transaction_id is not None:
            payment = await repo.mark_paid(paymentId, transaction_id)
        else:
            payment = await repo.mark_failed(paymentId, "Retry failed to record transaction in transaction-service")
        return mappers.orm_to_payment(payment)
