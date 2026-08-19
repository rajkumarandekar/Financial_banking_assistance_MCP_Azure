"""Client for transaction-service's GraphQL API.

Replaces the old plain REST POST to TRANSACTIONS_API_SERVER_URL
(app/business-api/python/payment/services.py, pre-migration) with a GraphQL
mutation call, per the target architecture's MCP -> GraphQL -> business logic
-> DB layering. transaction-service's notifyTransaction mutation is defined
in app/business-api/python/transaction/gql/mutations.py.
"""
import logging
import os
import uuid
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_MUTATION = """
mutation NotifyTransaction($input: NotifyTransactionInput!) {
  notifyTransaction(input: $input) {
    id
  }
}
"""


def _transaction_service_url() -> Optional[str]:
    return os.environ.get("TRANSACTION_SERVICE_URL")


async def notify_transaction(
    account_id: str,
    description: str,
    payment_type: Optional[str],
    amount: float,
    timestamp: str,
    recipient_name: Optional[str] = None,
    recipient_bank_code: Optional[str] = None,
    card_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
) -> Optional[str]:
    """Records the payment as a transaction in transaction-service.

    Returns the created transaction's id on success, or None on failure -
    callers should treat None as a failed notification (not silently ignore
    it, unlike the pre-migration REST version).
    """
    base_url = _transaction_service_url()
    if not base_url:
        logger.error("TRANSACTION_SERVICE_URL not configured - cannot notify transaction")
        return None

    url = f"{base_url.rstrip('/')}/graphql"
    variables = {
        "input": {
            "id": "TX" + uuid.uuid4().hex[:16].upper(),
            "accountId": account_id,
            "description": description,
            "type": "payment",
            "flowType": "outcome",
            "recipientName": recipient_name,
            "recipientBankReference": recipient_bank_code,
            "paymentType": payment_type,
            "amount": amount,
            "timestamp": timestamp,
            "cardId": card_id,
            "category": category,
            "status": status,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json={"query": _MUTATION, "variables": variables})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.exception("Failed to notify transaction-service: %s", exc)
        return None

    if payload.get("errors"):
        logger.error("transaction-service returned errors: %s", payload["errors"])
        return None

    transaction = (payload.get("data") or {}).get("notifyTransaction")
    return transaction["id"] if transaction else None
