from fastmcp import FastMCP
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

import source_clients
from db.base import get_session_context
from gql import mappers
from gql.repository import DocumentRepository

logger = logging.getLogger(__name__)
mcp = FastMCP("Document MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


def _check_self_or_admin(target_customer_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    if caller_customer_id is None or target_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to access this customer's documents")


def _new_id() -> str:
    return "DOC" + uuid.uuid4().hex[:14].upper()


@mcp.tool(name="generateStatement", description="Generate an account statement covering recent transactions")
async def generate_statement(
    accountId: Annotated[str, "Unique identifier for the account"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("generateStatement accountId=%s", accountId)
    account = await source_clients.get_account(accountId)
    if account is None:
        raise RuntimeError(f"Account {accountId} not found")
    _check_self_or_admin(account["customerId"], callerCustomerId, callerRole)

    transactions = await source_clients.get_account_transactions(accountId, limit=20)
    lines = [
        f"ACCOUNT STATEMENT",
        f"Account: {accountId} ({account['accountHolderFullName']})",
        f"Currency: {account['currency']}  Balance: {account['balance']}",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "Recent transactions:",
    ]
    for t in transactions:
        lines.append(f"  {t['timestamp']}  {t['description']:<40}  {t['amount']:>10.2f}  [{t.get('status') or ''}]")
    content = "\n".join(lines)

    async with get_session_context() as session:
        repo = DocumentRepository(session)
        doc = await repo.save_document(
            document_id=_new_id(),
            customer_id=account["customerId"],
            document_type="statement",
            title=f"Account Statement - {accountId}",
            content=content,
            related_entity_id=accountId,
        )
        return mappers.orm_to_document(doc)


@mcp.tool(name="generateReceipt", description="Generate a payment receipt")
async def generate_receipt(
    paymentId: Annotated[str, "Unique identifier for the payment"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("generateReceipt paymentId=%s", paymentId)
    payment = await source_clients.get_payment(paymentId)
    if payment is None:
        raise RuntimeError(f"Payment {paymentId} not found")
    _check_self_or_admin(payment["customerId"], callerCustomerId, callerRole)

    content = "\n".join(
        [
            "PAYMENT RECEIPT",
            f"Payment ID: {payment['id']}",
            f"Account: {payment['accountId']}",
            f"Description: {payment['description']}",
            f"Recipient: {payment.get('recipientName') or 'N/A'}",
            f"Amount: {payment['amount']:.2f}",
            f"Status: {payment['status']}",
            f"Transaction ref: {payment.get('transactionId') or 'N/A'}",
            f"Date: {payment.get('createdAt') or ''}",
        ]
    )

    async with get_session_context() as session:
        repo = DocumentRepository(session)
        doc = await repo.save_document(
            document_id=_new_id(),
            customer_id=payment["customerId"],
            document_type="receipt",
            title=f"Payment Receipt - {paymentId}",
            content=content,
            related_entity_id=paymentId,
        )
        return mappers.orm_to_document(doc)


@mcp.tool(name="generateLoanLetter", description="Generate a loan approval or rejection letter based on the loan's current status")
async def generate_loan_letter(
    loanId: Annotated[str, "Unique identifier for the loan"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("generateLoanLetter loanId=%s", loanId)
    loan = await source_clients.get_loan(loanId)
    if loan is None:
        raise RuntimeError(f"Loan {loanId} not found")
    _check_self_or_admin(loan["customerId"], callerCustomerId, callerRole)

    if loan["status"] in ("active", "closed"):
        doc_type = "loan_approval_letter"
        title = f"Loan Approval Letter - {loanId}"
        content = "\n".join(
            [
                "LOAN APPROVAL LETTER",
                f"Loan ID: {loan['id']}  Type: {loan['loanType']}",
                f"Principal: {loan['principalAmount']:.2f}  Interest rate: {loan['interestRate']}%  Tenure: {loan['tenureMonths']} months",
                f"Approved on: {loan.get('decisionDate') or ''}",
                f"First installment due: {loan['emiSchedule'][0]['dueDate'] if loan.get('emiSchedule') else 'N/A'}",
                "Congratulations, your loan has been approved.",
            ]
        )
    elif loan["status"] == "rejected":
        doc_type = "loan_rejection_letter"
        title = f"Loan Rejection Letter - {loanId}"
        content = "\n".join(
            [
                "LOAN REJECTION LETTER",
                f"Loan ID: {loan['id']}  Type: {loan['loanType']}",
                f"Decision date: {loan.get('decisionDate') or ''}",
                f"Reason: {loan.get('rejectionReason') or 'Not specified'}",
                "We regret to inform you that your loan application was not approved.",
            ]
        )
    else:
        raise RuntimeError(f"Loan {loanId} has no decision yet (status={loan['status']})")

    async with get_session_context() as session:
        repo = DocumentRepository(session)
        doc = await repo.save_document(
            document_id=_new_id(),
            customer_id=loan["customerId"],
            document_type=doc_type,
            title=title,
            content=content,
            related_entity_id=loanId,
        )
        return mappers.orm_to_document(doc)


@mcp.tool(name="getDocument", description="Retrieve a previously generated document")
async def get_document(
    documentId: Annotated[str, "Unique identifier for the document"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    async with get_session_context() as session:
        repo = DocumentRepository(session)
        doc = await repo.get_document(documentId)
        if doc is None:
            return None
        _check_self_or_admin(str(doc.customer_id), callerCustomerId, callerRole)
        return mappers.orm_to_document(doc)


@mcp.tool(name="listDocuments", description="List all documents generated for a customer (self, or any customer if admin)")
async def list_documents(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = DocumentRepository(session)
        rows = await repo.get_documents_by_customer(customerId)
        return [mappers.orm_to_summary(row) for row in rows]
