from fastmcp import FastMCP
import logging
from typing import Annotated, Optional

from db.base import get_session_context
from gql import mappers
from gql.repository import LoanRepository

logger = logging.getLogger(__name__)
mcp = FastMCP("Loan MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity and are NOT controlled by the LLM/agent."
)


def _check_self_or_admin(target_customer_id: str, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    if caller_role == "admin":
        return
    if caller_customer_id is None or target_customer_id != caller_customer_id:
        raise PermissionError("Not authorized to access this customer's loans")


@mcp.tool(name="applyLoan", description="Apply for a new loan (self, or on behalf of any customer if admin)")
async def apply_loan(
    customerId: Annotated[str, "Customer applying for the loan (UUID)"],
    loanType: Annotated[str, "Type of loan: personal, home, auto, education"],
    principalAmount: Annotated[float, "Requested loan principal amount"],
    interestRate: Annotated[float, "Annual interest rate percentage, e.g. 8.5"],
    tenureMonths: Annotated[int, "Repayment tenure in months"],
    accountId: Annotated[Optional[str], "Account to disburse/repay the loan against"] = None,
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("applyLoan customerId=%s loanType=%s principal=%s", customerId, loanType, principalAmount)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = LoanRepository(session)
        row = await repo.apply_loan(customerId, loanType, principalAmount, interestRate, tenureMonths, accountId)
        return mappers.orm_to_loan(row)


@mcp.tool(name="getLoans", description="Get all loans for a customer (self, or any customer if admin)")
async def get_loans(
    customerId: Annotated[str, "Customer id (UUID)"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getLoans customerId=%s callerRole=%s", customerId, callerRole)
    _check_self_or_admin(customerId, callerCustomerId, callerRole)
    async with get_session_context() as session:
        repo = LoanRepository(session)
        rows = await repo.get_loans_by_customer(customerId)
        return [mappers.orm_to_loan(row, include_schedule=True) for row in rows]


@mcp.tool(name="getLoanDetails", description="Get details and EMI schedule for a single loan")
async def get_loan_details(
    loanId: Annotated[str, "Unique identifier for the loan"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getLoanDetails loanId=%s", loanId)
    async with get_session_context() as session:
        repo = LoanRepository(session)
        row = await repo.get_loan_details(loanId)
        if row is None:
            return None
        _check_self_or_admin(str(row.customer_id), callerCustomerId, callerRole)
        return mappers.orm_to_loan(row, include_schedule=True)


@mcp.tool(name="getEmiSchedule", description="Get the EMI repayment schedule for a loan")
async def get_emi_schedule(
    loanId: Annotated[str, "Unique identifier for the loan"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getEmiSchedule loanId=%s", loanId)
    async with get_session_context() as session:
        repo = LoanRepository(session)
        row = await repo.get_loan_details(loanId)
        if row is None:
            return []
        _check_self_or_admin(str(row.customer_id), callerCustomerId, callerRole)
        return [mappers.orm_to_emi(e) for e in row.emi_schedule]


@mcp.tool(name="approveLoan", description="Approve a pending loan and generate its EMI schedule (admin only)")
async def approve_loan(
    loanId: Annotated[str, "Unique identifier for the loan"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("approveLoan loanId=%s callerRole=%s", loanId, callerRole)
    if callerRole != "admin":
        raise PermissionError("Only admin may approve loans")
    async with get_session_context() as session:
        repo = LoanRepository(session)
        row = await repo.approve_loan(loanId)
        return mappers.orm_to_loan(row, include_schedule=True)


@mcp.tool(name="rejectLoan", description="Reject a pending loan with a reason (admin only)")
async def reject_loan(
    loanId: Annotated[str, "Unique identifier for the loan"],
    reason: Annotated[str, "Reason for rejection"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("rejectLoan loanId=%s callerRole=%s", loanId, callerRole)
    if callerRole != "admin":
        raise PermissionError("Only admin may reject loans")
    async with get_session_context() as session:
        repo = LoanRepository(session)
        row = await repo.reject_loan(loanId, reason)
        return mappers.orm_to_loan(row)


@mcp.tool(name="payEmi", description="Pay the next due EMI installment on an active loan (self, or on behalf of any customer if admin)")
async def pay_emi(
    loanId: Annotated[str, "Unique identifier for the loan"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("payEmi loanId=%s", loanId)
    async with get_session_context() as session:
        repo = LoanRepository(session)
        loan = await repo._require_loan(loanId)
        _check_self_or_admin(str(loan.customer_id), callerCustomerId, callerRole)
        row = await repo.pay_emi(loanId)
        return mappers.orm_to_loan(row, include_schedule=True)


@mcp.tool(name="makeExtraPayment", description="Make a lump-sum extra payment toward an active loan, paying off as many upcoming installments as it covers (self, or on behalf of any customer if admin)")
async def make_extra_payment(
    loanId: Annotated[str, "Unique identifier for the loan"],
    amount: Annotated[float, "Extra payment amount"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("makeExtraPayment loanId=%s amount=%s", loanId, amount)
    async with get_session_context() as session:
        repo = LoanRepository(session)
        loan = await repo._require_loan(loanId)
        _check_self_or_admin(str(loan.customer_id), callerCustomerId, callerRole)
        row = await repo.make_extra_payment(loanId, amount)
        return mappers.orm_to_loan(row, include_schedule=True)
