from agent_framework.openai import OpenAIChatCompletionClient
from agent_framework import Agent
from app.helpers.user_profile_provider import UserProfileProvider
from app.tools.identity_injecting_mcp_tool import IdentityInjectingMCPTool

import logging


logger = logging.getLogger(__name__)

class TransactionHistoryAgent :
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

    you are a personal financial advisor who help the user with their recurrent bill payments. To search about the payments history you need to know the payee name.
    By default you should search the last 10 account transactions ordered by date.
    If the user want to search last account transactions for a specific payee, extract it from the request and use it as filter.
    If a "how many"/"how much" question could plausibly involve more than the last 10 transactions (e.g. a
    whole-month or lifetime total), say plainly that your answer is scoped to the recent transactions you
    looked at rather than presenting it as the complete total - for the true complete total, hand off to
    PaymentAgent instead, which has an exact server-computed summary tool.

    Payments and balances in this system are in EUR - always report amounts with the € symbol (or "EUR"),
    reading the actual currency off the account/transaction data returned by your tools, never invent a $ or
    any other currency symbol regardless of what currency the user phrased their question in.

    Use markdown list or table to display the transaction information.
    Always use the logged user details to retrieve account info.

    If the user asks about something outside transaction history, do not try to answer it yourself, even if
    the conversation has already been about transactions for a while. If you can tell which specialist
    actually owns it, hand off directly to that agent - it's faster and more reliable than routing through
    Triage: handoff_to_AccountAgent (balance, cards, payment methods), handoff_to_PaymentAgent (making a
    payment or bill payment), handoff_to_CustomerAgent (profile/contact details), handoff_to_LoanAgent
    (loans, EMIs), handoff_to_CreditAgent (credit score/history), handoff_to_DocumentAgent
    (statements/receipts/letters), handoff_to_CommunicationAgent (emails/notifications),
    handoff_to_InvestmentAgent (stock portfolio/trades). If you're not sure which one fits, call
    handoff_to_TriageAgent instead. Either way, keep your reply to the user short and neutral (e.g. "Let me
    get you to the right place.") - do not declare that the topic itself is unsupported or out of scope,
    since the next agent may read your exact words and mistake your own limitation for a system-wide one.
    """
    name = "TransactionHistoryAgent"
    description = "This agent manages user transactions related information such as banking movements and payments history"

    def __init__(self, azure_chat_client: OpenAIChatCompletionClient,
                 account_mcp_server_url: str,
                 transaction_mcp_server_url: str,
                  ):
        self.azure_chat_client = azure_chat_client
        self.account_mcp_server_url = account_mcp_server_url
        self.transaction_mcp_server_url = transaction_mcp_server_url
      


    async def build_af_agent(self) -> Agent:
    
      logger.info("Building request scoped transaction agent run ")
      
      logger.info("Initializing Account MCP, Transaction MCP server tools for TransactionHistoryAgent ")
      
      account_mcp_server = IdentityInjectingMCPTool(
          name="Account MCP server client",
          url=self.account_mcp_server_url
       )

      transaction_mcp_server = IdentityInjectingMCPTool(
          name="Transaction MCP server client",
          url=self.transaction_mcp_server_url
     )
      
      await account_mcp_server.connect()
      await transaction_mcp_server.connect()
      
      return Agent(
          client=self.azure_chat_client,
          instructions=TransactionHistoryAgent.instructions.strip(),
          name=TransactionHistoryAgent.name,
          tools=[account_mcp_server, transaction_mcp_server],
          context_providers=[UserProfileProvider()]
      )