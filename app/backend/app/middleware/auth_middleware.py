import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config.settings import settings
from app.helpers.auth import AuthError, validate_token
from app.helpers.request_context import current_user_ctx

logger = logging.getLogger(__name__)

# Paths that must stay reachable without a token (health checks, ChatKit's own
# auth-capability probe, docs). Prefix-matched.
_ALLOWLIST_PREFIXES = ("/auth_setup", "/api/auth_setup", "/health", "/docs", "/redoc", "/openapi.json")


class AuthMiddleware(BaseHTTPMiddleware):
    """Validates the Entra ID bearer token on every request when AUTH_ENABLED.

    When disabled (default until an Entra app registration exists), requests
    pass through unauthenticated and UserProfileHelper falls back to the mock
    user profile - see request_context.get_current_user().
    """

    async def dispatch(self, request: Request, call_next):
        if not settings.AUTH_ENABLED or request.url.path.startswith(_ALLOWLIST_PREFIXES):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})

        token = auth_header.removeprefix("Bearer ").strip()
        try:
            user = await validate_token(token)
        except AuthError as exc:
            logger.warning("Token validation failed: %s", exc.message)
            return JSONResponse(status_code=401, content={"detail": exc.message})

        request_token = current_user_ctx.set(user)
        try:
            return await call_next(request)
        finally:
            current_user_ctx.reset(request_token)
