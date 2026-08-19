"""Request-scoped authenticated-user context.

UserProfileProvider.before_run (agent_framework's ContextProvider hook) has no
direct access to the FastAPI Request, so AuthMiddleware stashes the validated
identity here for the duration of the request, and UserProfileHelper reads it
back out.
"""
from contextvars import ContextVar
from dataclasses import dataclass, field


@dataclass
class AuthenticatedUser:
    user_id: str
    email: str
    name: str
    customer_id: str | None
    roles: str  # "admin" | "customer"


_MOCK_USER = AuthenticatedUser(
    user_id="bob-user-123",
    email="rajkumarandekar1144@gmail.com",
    name="Rajkumar",
    customer_id="22222222-2222-2222-2222-222222222222",
    roles="customer",
)

current_user_ctx: ContextVar[AuthenticatedUser | None] = ContextVar("current_user_ctx", default=None)


def get_current_user() -> AuthenticatedUser:
    """Returns the request's authenticated user, or the mock user profile when
    AUTH_ENABLED is False (local dev / no Entra app registration yet)."""
    user = current_user_ctx.get()
    return user if user is not None else _MOCK_USER
