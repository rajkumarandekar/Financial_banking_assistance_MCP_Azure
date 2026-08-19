"""Backend-side client for customer-service's GraphQL API.

Used by app/helpers/auth.py to resolve a validated token's email into a real
customer_id + role, replacing the static demo_customer_map.py shim. Falls
back to that shim automatically when CUSTOMER_SERVICE_URL isn't configured
or the service is unreachable, so auth keeps working during local dev /
partial rollouts.
"""
import logging
from typing import Optional

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)

_QUERY = """
query CustomerByEmail($email: String!) {
  customerByEmail(email: $email) {
    id
    role
  }
}
"""


async def fetch_customer_id_and_role(email: str) -> Optional[tuple[str, str]]:
    """Returns (customer_id, role) from customer-service, or None if the
    service isn't configured/reachable, or no customer matches this email -
    callers should fall back to demo_customer_map.py in that case."""
    if not settings.CUSTOMER_SERVICE_URL:
        return None

    url = f"{settings.CUSTOMER_SERVICE_URL.rstrip('/')}/graphql"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json={"query": _QUERY, "variables": {"email": email}})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("customer-service lookup failed for email=%s: %s", email, exc)
        return None

    customer = (payload.get("data") or {}).get("customerByEmail")
    if not customer:
        return None
    return customer["id"], customer["role"]
