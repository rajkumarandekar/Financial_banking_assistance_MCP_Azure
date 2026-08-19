"""User profile helper for extracting user identity from auth tokens.

Provides user_id, user_email, customer_id and roles from the authenticated
user's token claims. Identity is resolved via AuthMiddleware + request_context
when AUTH_ENABLED is True; otherwise falls back to a mock user profile so the
rest of the system keeps working before an Entra ID app registration exists.
"""

import logging

from app.helpers.request_context import get_current_user

logger = logging.getLogger(__name__)


class UserProfileHelper:
    """Extracts user identity from the current request context.

    Usage::

        helper = UserProfileHelper()
        user_id = helper.get_user_id()
        email   = helper.get_user_email()
        customer_id = helper.get_customer_id()
        roles = helper.get_roles()
    """

    @staticmethod
    def get_user_id() -> str:
        """Return the unique identifier of the currently logged-in user."""
        return get_current_user().user_id

    @staticmethod
    def get_user_email() -> str:
        """Return the email of the currently logged-in user."""
        return get_current_user().email

    @staticmethod
    def get_customer_id() -> str | None:
        """Return the customer_id of the currently logged-in user, used to enforce
        row-level ownership in downstream business services (see
        app/backend/app/tools/identity_injecting_mcp_tool.py)."""
        return get_current_user().customer_id

    @staticmethod
    def get_roles() -> str:
        """Return the role of the currently logged-in user: "admin" or "customer"."""
        return get_current_user().roles
