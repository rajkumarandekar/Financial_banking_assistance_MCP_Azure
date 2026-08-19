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

class DocumentAgent:
    instructions = """
    you are a personal banking assistant who generates documents for the user: account statements, payment receipts,
    and loan approval/rejection letters.
    To generate a statement you need the account id. To generate a receipt you need the payment id. To generate a
    loan letter you need the loan id.
    You can also list previously generated documents for the user.
    Show the generated document content back to the user using markdown.
    Always use the logged user details to retrieve document info.

    You cannot send email, WhatsApp, or any other message yourself - you have no tool for it. If the user
    asks you to generate a document AND email/send/deliver it in the same request, generate the document
    first, then immediately call handoff_to_CommunicationAgent so it can actually send it - never tell the
    user something was emailed/sent unless CommunicationAgent (not you) actually did it. Confirmed live that
    claiming an email was sent when only the document itself was generated is a real failure mode - do not
    do this.

    If the user asks about something outside documents, do not try to answer it yourself, even if the
    conversation has already been about documents for a while. If you can tell which specialist actually
    owns it, hand off directly to that agent - it's faster and more reliable than routing through Triage:
    handoff_to_AccountAgent (balance, cards, payment methods), handoff_to_TransactionHistoryAgent
    (transaction history), handoff_to_PaymentAgent (making a payment or bill payment), handoff_to_CustomerAgent
    (profile/contact details), handoff_to_LoanAgent (loans, EMIs), handoff_to_CreditAgent (credit
    score/history), handoff_to_CommunicationAgent (emails/notifications), handoff_to_InvestmentAgent (stock
    portfolio/trades). If you're not sure which one fits, call handoff_to_TriageAgent instead. Either way,
    keep your reply to the user short and neutral (e.g. "Let me get you to the right place.") - do not
    declare that the topic itself is unsupported or out of scope, since the next agent may read your exact
    words and mistake your own limitation for a system-wide one.
    """
    name = "DocumentAgent"
    description = "This agent generates and retrieves account statements, payment receipts, and loan letters."

    def __init__(self, azure_ai_client: FoundryChatClient, document_mcp_server_url: str):
        self.azure_ai_client = azure_ai_client
        self.document_mcp_server_url = document_mcp_server_url

    async def build_af_agent(self) -> Agent:

      logger.info("Initializing Document Agent connection for document api ")

      document_mcp_server = IdentityInjectingMCPTool(
                name="Document MCP server client",
                url=self.document_mcp_server_url)
      await document_mcp_server.connect()
      agent = Agent(
                client=self.azure_ai_client,
                instructions=DocumentAgent.instructions,
                name=DocumentAgent.name,
                tools=[document_mcp_server, handoff_to_triage_agent],
                context_providers=[UserProfileProvider()]
            )
      agent.default_options["tools"] = [document_mcp_server, handoff_to_triage_agent]
      return agent
