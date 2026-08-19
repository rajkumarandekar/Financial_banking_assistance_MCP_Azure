"""GraphQL clients for pulling source data from the other services this
service generates documents from. document-service does not own any of this
data - services must not read each other's database tables directly.
"""
import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


async def _graphql(base_url_env: str, query: str, variables: dict) -> Optional[dict]:
    base_url = os.environ.get(base_url_env)
    if not base_url:
        logger.warning("%s not configured", base_url_env)
        return None
    url = f"{base_url.rstrip('/')}/graphql"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json={"query": query, "variables": variables})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("GraphQL call to %s failed: %s", base_url_env, exc)
        return None
    if payload.get("errors"):
        logger.warning("GraphQL errors from %s: %s", base_url_env, payload["errors"])
        return None
    return payload.get("data")


async def get_account(account_id: str) -> Optional[dict]:
    data = await _graphql(
        "ACCOUNT_SERVICE_URL",
        """
        query($accountId: String!) {
          accountDetails(accountId: $accountId) { id userName accountHolderFullName currency balance customerId }
        }
        """,
        {"accountId": account_id},
    )
    return data.get("accountDetails") if data else None


async def get_account_transactions(account_id: str, limit: int = 20) -> list[dict]:
    data = await _graphql(
        "TRANSACTION_SERVICE_URL",
        """
        query($accountId: String!, $limit: Int!) {
          lastTransactions(accountId: $accountId, limit: $limit) {
            id description amount timestamp category status
          }
        }
        """,
        {"accountId": account_id, "limit": limit},
    )
    return data.get("lastTransactions", []) if data else []


async def get_payment(payment_id: str) -> Optional[dict]:
    data = await _graphql(
        "PAYMENT_SERVICE_URL",
        """
        query($paymentId: String!) {
          paymentDetails(paymentId: $paymentId) {
            id customerId accountId description recipientName amount status transactionId createdAt
          }
        }
        """,
        {"paymentId": payment_id},
    )
    return data.get("paymentDetails") if data else None


async def get_loan(loan_id: str) -> Optional[dict]:
    data = await _graphql(
        "LOAN_SERVICE_URL",
        """
        query($loanId: String!) {
          loanDetails(loanId: $loanId) {
            id customerId loanType principalAmount interestRate tenureMonths status
            appliedDate decisionDate rejectionReason
            emiSchedule { installmentNumber dueDate amount }
          }
        }
        """,
        {"loanId": loan_id},
    )
    return data.get("loanDetails") if data else None
