"""Client for transaction-service's GraphQL API.

Same pattern as payment/transaction_service_client.py - card payments and
recharges are money movements too, so they need to be visible in transaction
history/Dashboard/Analytics the same way person/bill payments already are
(BUG-004: previously pay_with_card/recharge_card never called this at all).
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
    flow_type: str = "outcome",
    card_id: Optional[str] = None,
    category: Optional[str] = None,
) -> Optional[str]:
    """Records a card payment/recharge as a transaction in transaction-service.

    Returns the created transaction's id on success, or None on failure -
    callers should log a failure rather than silently ignore it.
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
            "flowType": flow_type,
            "paymentType": payment_type,
            "amount": amount,
            "timestamp": timestamp,
            "cardId": card_id,
            "category": category,
            # A transaction only gets created here because the card
            # balance/recharge update just committed successfully - "paid"
            # is the only status that's ever actually true for it. Same fix
            # as payment-service's notify_transaction calls (was left unset
            # here entirely, which stored NULL on the transaction row).
            "status": "paid",
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
