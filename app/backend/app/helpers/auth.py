"""Entra ID (Azure AD) JWT validation.

Validates the "Authorization: Bearer <token>" header against Azure AD's OpenID
configuration for the configured tenant: signature (via JWKS), audience, issuer,
and expiry. Only active when settings.AUTH_ENABLED is True - see
docs/entra-app-registration-setup.md for how to provision the app registration
this depends on (AZURE_TENANT_ID / AZURE_AD_BACKEND_CLIENT_ID).
"""
import logging
import time
from typing import Any

import httpx
from jose import jwt
from jose.exceptions import JOSEError

from app.config.settings import settings
from app.helpers.customer_service_client import fetch_customer_id_and_role
from app.helpers.demo_customer_map import resolve_customer_id_and_role
from app.helpers.request_context import AuthenticatedUser

logger = logging.getLogger(__name__)

_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0.0}
_JWKS_CACHE_TTL_SECONDS = 3600


class AuthError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _oidc_config_url() -> str:
    return f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration"


def _expected_issuer() -> str:
    return settings.AZURE_AD_ISSUER or f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/v2.0"


async def _get_jwks() -> dict[str, Any]:
    now = time.monotonic()
    if _jwks_cache["keys"] is not None and (now - _jwks_cache["fetched_at"]) < _JWKS_CACHE_TTL_SECONDS:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        oidc_config = (await client.get(_oidc_config_url())).json()
        jwks = (await client.get(oidc_config["jwks_uri"])).json()

    _jwks_cache["keys"] = jwks
    _jwks_cache["fetched_at"] = now
    return jwks


async def validate_token(token: str) -> AuthenticatedUser:
    """Validates the bearer token and returns the resolved AuthenticatedUser.

    Raises AuthError on any validation failure (bad signature, wrong audience,
    wrong issuer, expired token).
    """
    if not settings.AZURE_TENANT_ID or not settings.AZURE_AD_BACKEND_CLIENT_ID:
        raise AuthError("AUTH_ENABLED but AZURE_TENANT_ID/AZURE_AD_BACKEND_CLIENT_ID are not configured")

    try:
        jwks = await _get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = next(
            (
                {"kty": k["kty"], "kid": k["kid"], "use": k["use"], "n": k["n"], "e": k["e"]}
                for k in jwks["keys"]
                if k["kid"] == unverified_header.get("kid")
            ),
            None,
        )
        if rsa_key is None:
            raise AuthError("Signing key not found in JWKS for this token")

        claims = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.AZURE_AD_BACKEND_CLIENT_ID,
            issuer=_expected_issuer(),
        )
    except JOSEError as exc:
        raise AuthError(f"Token validation failed: {exc}") from exc

    email = claims.get("preferred_username") or claims.get("email") or claims.get("upn")
    user_id = claims.get("oid") or claims.get("sub")
    name = claims.get("name") or email or user_id

    # customer-service is the real source of truth once configured; the static
    # demo_customer_map.py shim covers local dev or partial rollouts where it
    # isn't deployed yet.
    resolved = await fetch_customer_id_and_role(email) if email else None
    if resolved is not None:
        customer_id, role = resolved
    else:
        customer_id, role = resolve_customer_id_and_role(email)

    return AuthenticatedUser(user_id=user_id, email=email, name=name, customer_id=customer_id, roles=role)
