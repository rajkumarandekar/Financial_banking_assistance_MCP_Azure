"""Client for credit-service's GraphQL API.

Same pattern as loan/credit_service_client.py and transaction_service_client.py
in this same service - paying down a credit card's utilization is a real
credit-scoring input, so pay_with_card now reports a meaningful utilization
improvement here instead of leaving the score frozen at its seed value.
"""
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_MUTATION = """
mutation RecordCreditEvent($customerId: String!, $eventId: String!, $eventType: String!, $impact: String!, $description: String) {
  recordCreditEvent(customerId: $customerId, eventId: $eventId, eventType: $eventType, impact: $impact, description: $description) {
    id
  }
}
"""


def _credit_service_url() -> Optional[str]:
    return os.environ.get("CREDIT_SERVICE_URL")


async def record_credit_event(
    customer_id: str, event_id: str, event_type: str, impact: str, description: Optional[str] = None
) -> bool:
    """Best-effort - a credit-score side effect failing must never roll back
    or block the card payment that triggered it. Returns whether it
    succeeded, purely for logging."""
    base_url = _credit_service_url()
    if not base_url:
        logger.warning("CREDIT_SERVICE_URL not configured - skipping credit event")
        return False

    url = f"{base_url.rstrip('/')}/graphql"
    variables = {
        "customerId": customer_id,
        "eventId": event_id,
        "eventType": event_type,
        "impact": impact,
        "description": description,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json={"query": _MUTATION, "variables": variables})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Failed to notify credit-service: %s", exc)
        return False

    if payload.get("errors"):
        logger.warning("credit-service returned errors: %s", payload["errors"])
        return False
    return True
