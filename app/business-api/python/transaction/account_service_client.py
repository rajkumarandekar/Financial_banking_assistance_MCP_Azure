"""Client for account-service's GraphQL API, used to resolve an account's
customer_id for ownership checks in mcp_tools.py.

Transaction-service does NOT read account_schema's tables directly - services
must not freely access another service's database tables, per the platform's
service-boundary rule. This is the cross-service call instead.
"""
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_QUERY = """
query AccountDetails($accountId: String!) {
  accountDetails(accountId: $accountId) {
    id
    customerId
  }
}
"""


def _account_service_url() -> Optional[str]:
    return os.environ.get("ACCOUNT_SERVICE_URL")


async def get_account_customer_id(account_id: str) -> Optional[str]:
    """Returns the account's owning customer_id, or None if unknown/unreachable."""
    base_url = _account_service_url()
    if not base_url:
        logger.warning("ACCOUNT_SERVICE_URL not configured - cannot verify account ownership")
        return None

    url = f"{base_url.rstrip('/')}/graphql"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json={"query": _QUERY, "variables": {"accountId": account_id}})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("account-service lookup failed for account_id=%s: %s", account_id, exc)
        return None

    account = (payload.get("data") or {}).get("accountDetails")
    return account["customerId"] if account else None
