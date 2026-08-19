"""Dependency injection container configuration."""

import os
from dependency_injector import containers, providers
from azure.ai.projects import AIProjectClient
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.storage.blob import BlobServiceClient

from app.helpers.blob_proxy import BlobStorageProxy
from app.tools.document_intelligence_scanner import DocumentIntelligenceInvoiceScanHelper
from app.config.azure_credential import get_azure_credential, get_async_azure_credential
from app.config.settings import settings
from app.routers.chatkit.cosmosdb_store import CosmosDBStore


def _create_cosmosdb_store() -> CosmosDBStore | None:
    """Create a CosmosDB store only when an endpoint is configured."""
    if not settings.AZURE_COSMOSDB_ENDPOINT:
        return None
    from azure.cosmos.aio import CosmosClient as AsyncCosmosClient
    client = AsyncCosmosClient(
        url=settings.AZURE_COSMOSDB_ENDPOINT,
        credential=get_async_azure_credential(),
    )
    return CosmosDBStore(cosmos_client=client, database_name=settings.AZURE_COSMOSDB_DATABASE)

#Azure Chat based agents for simple handoff
from app.agents.azure_chat.simple.account_agent import AccountAgent
from app.agents.azure_chat.simple.transaction_agent import TransactionHistoryAgent
from app.agents.azure_chat.simple.payment_agent import PaymentAgent
from app.agents.azure_chat.simple.handoff_orchestrator import HandoffOrchestrator

#Azure Chat based agents for handoff with ChatKit protocol
from app.agents.azure_chat.handoff_orchestrator import HandoffOrchestrator as HandoffOrchestratorChatKit
from app.agents.azure_chat.account_agent import AccountAgent as AccountAgentChatKit
from app.agents.azure_chat.transaction_agent import TransactionHistoryAgent as TransactionHistoryAgentChatKit
from app.agents.azure_chat.payment_agent import PaymentAgent as PaymentAgentChatKit
from app.agents.azure_chat.customer_agent import CustomerAgent as CustomerAgentChatKit
from app.agents.azure_chat.loan_agent import LoanAgent as LoanAgentChatKit
from app.agents.azure_chat.credit_agent import CreditAgent as CreditAgentChatKit
from app.agents.azure_chat.document_agent import DocumentAgent as DocumentAgentChatKit
from app.agents.azure_chat.communication_agent import CommunicationAgent as CommunicationAgentChatKit
from app.agents.azure_chat.investment_agent import InvestmentAgent as InvestmentAgentChatKit

from agent_framework.openai import OpenAIChatCompletionClient




class Container(containers.DeclarativeContainer):
    """IoC container for application dependencies."""
   
    # Cosmos DB ChatKit metadata store (None when AZURE_COSMOSDB_ENDPOINT is not set)
    cosmosdb_store = providers.Singleton(_create_cosmosdb_store)

    # Helpers
    blob_service_client = providers.Singleton(
        BlobServiceClient,
        credential = providers.Factory(get_azure_credential),
        account_url = f"https://{settings.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"
    )

    blob_proxy = providers.Singleton(
        BlobStorageProxy,
        client = blob_service_client,
        container_name = settings.AZURE_STORAGE_CONTAINER
    )

    # Document Intelligence client singleton
    document_intelligence_client = providers.Singleton(
        DocumentIntelligenceClient,
        credential=providers.Factory(get_azure_credential),
        endpoint=f"https://{settings.AZURE_DOCUMENT_INTELLIGENCE_SERVICE}.cognitiveservices.azure.com/"
    )

    # Document Intelligence scanner singleton
    document_intelligence_scanner = providers.Singleton(
        DocumentIntelligenceInvoiceScanHelper,
        client=document_intelligence_client,
        blob_storage_proxy=blob_proxy
    )
    


    # Azure Chat based agents. Unfortunately we can't create reusable singleton instance of OpenAIChatCompletionClient as it does not support token expiration management.
    _azure_chat_client = providers.Factory(
        OpenAIChatCompletionClient,
        credential=providers.Factory(get_azure_credential),
        azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME,
        # Surfaces the real validation error (e.g. "field required: customerId") back
        # to the model on a bad tool call instead of the generic "Argument parsing
        # failed." - confirmed live that the generic message left the model unable to
        # self-correct and it just repeated the same broken call until it hit the
        # framework's 3-consecutive-error cap and gave up.
        # max_consecutive_errors_per_request raised from the framework default of 3
        # to 5: confirmed live (getLoans specifically) that the model reliably
        # self-corrects a malformed tool call within 2-3 attempts when given room to
        # (verified via a standalone agent.run() with no cap pressure, 3/3 attempts
        # succeeded), but the default budget of 3 sometimes isn't quite enough headroom
        # inside the full multi-agent workflow before it gives up and tells the user
        # to contact support instead of just trying once or twice more.
        function_invocation_configuration={"include_detailed_errors": True, "max_consecutive_errors_per_request": 5},
    )

    #Account Agent with Azure chat based agents. Can be singleton as thread state is passed to the underlying agent run method
    account_agent = providers.Factory(
    AccountAgent,
    azure_chat_client=_azure_chat_client,
    account_mcp_server_url=f"{settings.ACCOUNT_MCP_URL}/mcp"
    )

    transaction_agent = providers.Factory(
    TransactionHistoryAgent,
    azure_chat_client=_azure_chat_client,
    account_mcp_server_url=f"{settings.ACCOUNT_MCP_URL}/mcp",
    transaction_mcp_server_url=f"{settings.TRANSACTION_MCP_URL}/mcp"
    )

    payment_agent = providers.Factory(
    PaymentAgent,
    azure_chat_client=_azure_chat_client,
    account_mcp_server_url=f"{settings.ACCOUNT_MCP_URL}/mcp",
    transaction_mcp_server_url=f"{settings.TRANSACTION_MCP_URL}/mcp",
    payment_mcp_server_url=f"{settings.PAYMENT_MCP_URL}/mcp",
    document_scanner_helper=document_intelligence_scanner
    )

  
    #Supervisor Agent implemented using agent framework handoff built-in orchestration with Azure chat based agents. A per request instance is created as based on recommendation from agent framework team about managing workflow instance.
    handoff_orchestrator = providers.Factory(
        HandoffOrchestrator,
        azure_chat_client=_azure_chat_client,
        account_agent=account_agent,
        transaction_agent=transaction_agent,
        payment_agent=payment_agent
    )

    ############# ChatKit based agents and orchestrator #############

    #Account Agent with Azure chat based agents. Must be Factory (not Singleton) so a fresh OpenAIChatCompletionClient with valid credentials is created per request.
    account_agent_chatkit = providers.Factory(
    AccountAgentChatKit,
    azure_chat_client=_azure_chat_client,
    account_mcp_server_url=f"{settings.ACCOUNT_MCP_URL}/mcp"
    )

    transaction_agent_chatkit = providers.Factory(
    TransactionHistoryAgentChatKit,
    azure_chat_client=_azure_chat_client,
    account_mcp_server_url=f"{settings.ACCOUNT_MCP_URL}/mcp",
    transaction_mcp_server_url=f"{settings.TRANSACTION_MCP_URL}/mcp"
    )

    payment_agent_chatkit = providers.Factory(
    PaymentAgentChatKit,
    azure_chat_client=_azure_chat_client,
    account_mcp_server_url=f"{settings.ACCOUNT_MCP_URL}/mcp",
    transaction_mcp_server_url=f"{settings.TRANSACTION_MCP_URL}/mcp",
    payment_mcp_server_url=f"{settings.PAYMENT_MCP_URL}/mcp",
    document_scanner_helper=document_intelligence_scanner
    )

    customer_agent_chatkit = providers.Factory(
    CustomerAgentChatKit,
    azure_chat_client=_azure_chat_client,
    customer_mcp_server_url=f"{settings.CUSTOMER_MCP_URL}/mcp"
    )

    loan_agent_chatkit = providers.Factory(
    LoanAgentChatKit,
    azure_chat_client=_azure_chat_client,
    loan_mcp_server_url=f"{settings.LOAN_MCP_URL}/mcp"
    )

    credit_agent_chatkit = providers.Factory(
    CreditAgentChatKit,
    azure_chat_client=_azure_chat_client,
    credit_mcp_server_url=f"{settings.CREDIT_MCP_URL}/mcp"
    )

    document_agent_chatkit = providers.Factory(
    DocumentAgentChatKit,
    azure_chat_client=_azure_chat_client,
    document_mcp_server_url=f"{settings.DOCUMENT_MCP_URL}/mcp"
    )

    communication_agent_chatkit = providers.Factory(
    CommunicationAgentChatKit,
    azure_chat_client=_azure_chat_client,
    communication_mcp_server_url=f"{settings.COMMUNICATION_MCP_URL}/mcp"
    )

    investment_agent_chatkit = providers.Factory(
    InvestmentAgentChatKit,
    azure_chat_client=_azure_chat_client,
    investment_mcp_server_url=f"{settings.INVESTMENT_MCP_URL}/mcp"
    )

    # A specialized chatkit Supervisor Agent implemented using agent framework handoff built-in orchestration with Azure chat based agents.
    # A per request instance is created as based on recommendation from agent framework team about managing workflow instance.
    handoff_orchestrator_chatkit = providers.Factory(
        HandoffOrchestratorChatKit,
        azure_chat_client=_azure_chat_client,
        account_agent=account_agent_chatkit,
        transaction_agent=transaction_agent_chatkit,
        payment_agent=payment_agent_chatkit,
        customer_agent=customer_agent_chatkit,
        loan_agent=loan_agent_chatkit,
        credit_agent=credit_agent_chatkit,
        document_agent=document_agent_chatkit,
        communication_agent=communication_agent_chatkit,
        investment_agent=investment_agent_chatkit
    )
   