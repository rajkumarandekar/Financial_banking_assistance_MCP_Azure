"""MCPStreamableHTTPTool subclass that injects the caller's validated identity
into every outgoing tool call.

This is the critical enforcement point: the LLM/agent never controls
callerCustomerId/callerRole - the backend injects them from the authenticated
request's context (see app/helpers/request_context.py) before the call leaves
the backend process, overriding anything the model tries to pass for those
argument names. The MCP-side service (e.g. account-service's mcp_tools.py)
independently re-validates ownership too - defense in depth.
"""
import logging
from typing import Any

from agent_framework import MCPStreamableHTTPTool

from app.helpers.user_profile_helper import UserProfileHelper

logger = logging.getLogger(__name__)


class IdentityInjectingMCPTool(MCPStreamableHTTPTool):
    async def call_tool(self, tool_name: str, **kwargs: Any) -> Any:
        kwargs["callerCustomerId"] = UserProfileHelper.get_customer_id()
        kwargs["callerRole"] = UserProfileHelper.get_roles()
        logger.debug(
            "Injecting identity into MCP call tool=%s customerId=%s role=%s",
            tool_name,
            kwargs["callerCustomerId"],
            kwargs["callerRole"],
        )
        return await super().call_tool(tool_name, **kwargs)
