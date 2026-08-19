"""User profile context provider for agent framework.

Provides logged user details and current timestamp to agents via the
Agent Framework context provider mechanism. Delegates user identity
resolution to ``UserProfileHelper``.
"""

from datetime import datetime
from typing import Any

from agent_framework import AgentSession, ContextProvider, SessionContext

from app.helpers.user_profile_helper import UserProfileHelper

import logging

logger = logging.getLogger(__name__)


class UserProfileProvider(ContextProvider):
    """Injects the current user's email and timestamp into every agent run.

    User identity is resolved via ``UserProfileHelper`` which in production
    would extract claims from an OIDC token.
    """

    DEFAULT_SOURCE_ID = "user_profile_provider"

    def __init__(self, source_id: str = DEFAULT_SOURCE_ID, **kwargs: Any):
        super().__init__(source_id)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_logged_user_email() -> str:
        """Return the email of the currently logged-in user."""
        return UserProfileHelper.get_user_email()

    @staticmethod
    def _get_current_timestamp() -> str:
        """Return the current date-time formatted as a string."""
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def _get_customer_id() -> str | None:
        """Return the customer_id of the currently logged-in user.

        This is prompt context only, telling the LLM what value to pass when a
        tool requires an explicit customerId argument for a self-lookup (e.g.
        getLoans, getCreditScore). It is NOT the security boundary - every MCP
        tool independently re-validates the caller's identity against the
        server-injected callerCustomerId (see identity_injecting_mcp_tool.py),
        so a malicious/confused LLM passing the wrong customerId here still
        gets denied, not trusted.
        """
        return UserProfileHelper.get_customer_id()

    @staticmethod
    def _get_role() -> str:
        """Return the role of the currently logged-in user: admin|customer."""
        return UserProfileHelper.get_roles()

    # ------------------------------------------------------------------
    # Context provider hooks
    # ------------------------------------------------------------------

    async def before_run(
        self,
        *,
        agent: Any,
        session: AgentSession | None,
        context: SessionContext,
        state: dict[str, Any],
    ) -> None:
        """Provide user profile context before each agent call."""
        user_email = self._get_logged_user_email()
        current_timestamp = self._get_current_timestamp()
        customer_id = self._get_customer_id()
        role = self._get_role()

        logger.debug(
            "UserProfileProvider injecting context – user=%s, customer_id=%s, role=%s, timestamp=%s",
            user_email,
            customer_id,
            role,
            current_timestamp,
        )

        context.extend_instructions(
            self.source_id,
            f"#Logged user information",
        )
        context.extend_instructions(
            self.source_id,
            f"Email: {user_email}",
        )
        context.extend_instructions(
            self.source_id,
            f"Customer ID: {customer_id}",
        )
        context.extend_instructions(
            self.source_id,
            f"Role: {role}",
        )
        context.extend_instructions(
            self.source_id,
            "When a tool requires a customerId argument for the logged-in user's own "
            "data, use the Customer ID above. Never guess or fabricate a customerId.",
        )
        context.extend_instructions(
            self.source_id,
            f"Current timestamp: {current_timestamp}",
        )
