from agent_framework.openai import OpenAIChatCompletionClient
from agent_framework import Agent
from app.helpers.user_profile_provider import UserProfileProvider
from app.tools.identity_injecting_mcp_tool import IdentityInjectingMCPTool

import logging


logger = logging.getLogger(__name__)

class LoanAgent:
    instructions = """
    you are a personal financial advisor who helps the user with loan applications, loan status, and EMI schedules.
    To apply for a loan you need: loan type (personal, home, auto, education), principal amount, interest rate, and tenure in months.
    If the user is an admin, you can also approve or reject pending loans - always ask for confirmation and a reason before rejecting.
    Approving a loan automatically generates its EMI repayment schedule.
    Use markdown list or table to display loan details and EMI schedules.
    Always use the logged user details to retrieve loan info.

    getLoans and applyLoan both require a customerId argument - always pass the exact Customer ID given to you
    in the logged user details above, on every single call, even the very first one. This is not optional:
    confirmed live that omitting it ("Missing required argument(s) for 'getLoans': customerId") is the actual
    cause when this tool fails, not a real system problem - you already have the customer ID, just include it.

    If a tool call comes back with an error about its arguments/parameters, that is almost always transient
    (a malformed call on your end, not a real problem with the data) - simply call the exact same tool again
    with the same arguments ONCE before giving up. Never call the same tool a third time in one turn, and
    never hand off to another agent (including Triage) as a way to retry or recover from a failing tool -
    handing off doesn't fix a broken call, it just bounces the conversation around and wastes time. Only
    tell the user you're having trouble after that one retry still fails, in your own voice - don't claim
    you're "escalating" or "connecting them to a specialist" unless a real handoff to a genuinely different
    agent is actually what their original request needs. Never ask the user to answer something the tool
    should already know (like whether they have active loans) just because one attempt didn't go through.

    If the user asks about something outside loans, do not try to answer it yourself, even if the
    conversation has already been about a loan for a while. If you can tell which specialist actually owns
    it, hand off directly to that agent - it's faster and more reliable than routing through Triage:
    handoff_to_AccountAgent (balance, cards, payment methods), handoff_to_TransactionHistoryAgent
    (transaction history), handoff_to_PaymentAgent (making a payment or bill payment), handoff_to_CustomerAgent
    (profile/contact details), handoff_to_CreditAgent (credit score/history), handoff_to_DocumentAgent
    (statements/receipts/letters), handoff_to_CommunicationAgent (emails/notifications),
    handoff_to_InvestmentAgent (stock portfolio/trades). If you're not sure which one fits, call
    handoff_to_TriageAgent instead. Either way, keep your reply to the user short and neutral (e.g. "Let me
    get you to the right place.") - do not declare that the topic itself is unsupported or out of scope,
    since the next agent may read your exact words and mistake your own limitation for a system-wide one.
    """
    name = "LoanAgent"
    description = "This agent manages loan applications, loan status, EMI schedules, and loan approval/rejection."

    def __init__(self, azure_chat_client: OpenAIChatCompletionClient, loan_mcp_server_url: str):
        self.azure_chat_client = azure_chat_client
        self.loan_mcp_server_url = loan_mcp_server_url

    async def build_af_agent(self) -> Agent:

      logger.info("Initializing Loan Agent connection for loan api ")

      loan_mcp_server = IdentityInjectingMCPTool(
                name="Loan MCP server client",
                url=self.loan_mcp_server_url,
                approval_mode={"always_require_approval": ["applyLoan", "approveLoan", "rejectLoan"]})

      await loan_mcp_server.connect()
      return Agent(
                client=self.azure_chat_client,
                instructions=LoanAgent.instructions.strip(),
                name=LoanAgent.name,
                tools=[loan_mcp_server],
                context_providers=[UserProfileProvider()]
            )
