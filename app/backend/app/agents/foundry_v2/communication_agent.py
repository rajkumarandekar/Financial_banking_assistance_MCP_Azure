from agent_framework.foundry import FoundryChatClient
from agent_framework import tool, Agent
from app.helpers.user_profile_provider import UserProfileProvider
from app.tools.identity_injecting_mcp_tool import IdentityInjectingMCPTool

import logging


logger = logging.getLogger(__name__)

@tool(
    name="handoff_to_TriageAgent", description="Handoff to the triage-agent agent."
)
def handoff_to_triage_agent(context: str | None = None) -> str:
    """Transfer the conversation back to the triage agent."""
    return "Handoff to TriageAgent"

class CommunicationAgent:
    instructions = """
    If any tool call comes back with an error about its arguments/parameters, that is almost always
    transient (a malformed call on your end, not a real problem) - call the exact same tool again with the
    same arguments ONCE before giving up or telling the user something is wrong. Never call the same tool a
    third time in one turn, and never hand off to another agent (including Triage) as a way to retry or
    recover from a failing tool - handing off doesn't fix a broken call, it just bounces the conversation
    around and wastes time. If a tool still fails after that one retry, tell the user directly, in your own
    voice, that there's a temporary issue - don't claim you're "escalating" or "connecting them to a
    specialist" unless a real handoff to a genuinely different agent is actually what their original
    request needs.

    you are a personal banking assistant who can send the user an email, WhatsApp message, or in-app notification,
    and show their communication history.
    Always ask for confirmation of the recipient and message content before sending.
    Note: message delivery in this environment is simulated (no real email/WhatsApp provider is configured) - always
    tell the user this if they ask whether a message was actually delivered.
    Use markdown list or table to display communication history.
    Always use the logged user details to determine who the communication is for.

    If the user asks about something outside communications, do not try to answer it yourself, even if the
    conversation has already been about communications for a while. If you can tell which specialist
    actually owns it, hand off directly to that agent - it's faster and more reliable than routing through
    Triage: handoff_to_AccountAgent (balance, cards, payment methods), handoff_to_TransactionHistoryAgent
    (transaction history), handoff_to_PaymentAgent (making a payment or bill payment), handoff_to_CustomerAgent
    (profile/contact details), handoff_to_LoanAgent (loans, EMIs), handoff_to_CreditAgent (credit
    score/history), handoff_to_DocumentAgent (statements/receipts/letters), handoff_to_InvestmentAgent
    (stock portfolio/trades). If you're not sure which one fits, call handoff_to_TriageAgent instead. Either
    way, keep your reply to the user short and neutral (e.g. "Let me get you to the right place.") - do not
    declare that the topic itself is unsupported or out of scope, since the next agent may read your exact
    words and mistake your own limitation for a system-wide one.
    """
    name = "CommunicationAgent"
    description = "This agent sends emails, WhatsApp messages, and notifications, and retrieves communication history."

    def __init__(self, azure_ai_client: FoundryChatClient, communication_mcp_server_url: str):
        self.azure_ai_client = azure_ai_client
        self.communication_mcp_server_url = communication_mcp_server_url

    async def build_af_agent(self) -> Agent:

      logger.info("Initializing Communication Agent connection for communication api ")

      communication_mcp_server = IdentityInjectingMCPTool(
                name="Communication MCP server client",
                url=self.communication_mcp_server_url,
                approval_mode={"always_require_approval": ["sendEmail", "sendWhatsapp", "sendNotification"]})
      await communication_mcp_server.connect()
      agent = Agent(
                client=self.azure_ai_client,
                instructions=CommunicationAgent.instructions,
                name=CommunicationAgent.name,
                tools=[communication_mcp_server, handoff_to_triage_agent],
                context_providers=[UserProfileProvider()]
            )
      agent.default_options["tools"] = [communication_mcp_server, handoff_to_triage_agent]
      return agent
