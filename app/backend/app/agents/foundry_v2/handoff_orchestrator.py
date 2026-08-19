import asyncio
from typing import Any, AsyncGenerator
from collections.abc import AsyncIterable,Sequence
from agent_framework import CheckpointStorage, SupportsAgentRun,FunctionTool,tool,Content,AgentResponseUpdate, Agent,InMemoryCheckpointStorage,WorkflowCheckpoint, WorkflowEvent
from agent_framework.exceptions import AgentFrameworkException
from agent_framework.foundry import FoundryChatClient
from app.agents.foundry_v2.account_agent import AccountAgent
from app.agents.foundry_v2.transaction_agent import TransactionHistoryAgent
from app.agents.foundry_v2.payment_agent import PaymentAgent
from app.agents.foundry_v2.customer_agent import CustomerAgent
from app.agents.foundry_v2.loan_agent import LoanAgent
from app.agents.foundry_v2.credit_agent import CreditAgent
from app.agents.foundry_v2.document_agent import DocumentAgent
from app.agents.foundry_v2.communication_agent import CommunicationAgent
from app.agents.foundry_v2.investment_agent import InvestmentAgent
from app.helpers.no_history_provider import NoHistoryProvider
from app.helpers.conversation_logger import TurnTracker
from uuid import uuid4
import logging

from agent_framework.orchestrations import (
    HandoffAgentExecutor,
    HandoffBuilder,
    HandoffConfiguration,
    HandoffAgentUserRequest
)

logger = logging.getLogger(__name__)



# Define handoff tools upfront for Azure AI Agents.
# Azure AI Agents require tools to be defined at agent creation time (server-side),
# so we create the handoff tools here and pass them during agent creation.
# The HandoffBuilder's middleware will intercept these tool calls to perform routing.
@tool(
    name="handoff_to_TriageAgent", description="Handoff to the triage-agent agent."
)
def handoff_to_triage_agent(context: str | None = None) -> str:
    """Transfer the conversation back to the triage agent."""
    return "Handoff to TriageAgent"

@tool(
    name="handoff_to_AccountAgent", description="Handoff to the account-agent agent."
)
def handoff_to_account_agent(context: str | None = None) -> str:
    """Transfer the conversation to the account agent."""
    return "Handoff to AccountAgent"

@tool(
    name="handoff_to_TransactionHistoryAgent", description="Handoff to the transaction-history-agent agent."
)
def handoff_to_transaction_history_agent(context: str | None = None) -> str:
    """Transfer the conversation to the transaction history agent."""
    return "Handoff to TransactionHistoryAgent"

@tool(
    name="handoff_to_PaymentAgent", description="Handoff to the payment-agent agent."
)
def handoff_to_payment_agent(context: str | None = None) -> str:
    """Transfer the conversation to the payment agent."""
    return "Handoff to PaymentAgent"

@tool(
    name="handoff_to_CustomerAgent", description="Handoff to the customer-agent agent."
)
def handoff_to_customer_agent(context: str | None = None) -> str:
    """Transfer the conversation to the customer agent."""
    return "Handoff to CustomerAgent"

@tool(
    name="handoff_to_LoanAgent", description="Handoff to the loan-agent agent."
)
def handoff_to_loan_agent(context: str | None = None) -> str:
    """Transfer the conversation to the loan agent."""
    return "Handoff to LoanAgent"

@tool(
    name="handoff_to_CreditAgent", description="Handoff to the credit-agent agent."
)
def handoff_to_credit_agent(context: str | None = None) -> str:
    """Transfer the conversation to the credit agent."""
    return "Handoff to CreditAgent"

@tool(
    name="handoff_to_DocumentAgent", description="Handoff to the document-agent agent."
)
def handoff_to_document_agent(context: str | None = None) -> str:
    """Transfer the conversation to the document agent."""
    return "Handoff to DocumentAgent"

@tool(
    name="handoff_to_CommunicationAgent", description="Handoff to the communication-agent agent."
)
def handoff_to_communication_agent(context: str | None = None) -> str:
    """Transfer the conversation to the communication agent."""
    return "Handoff to CommunicationAgent"

@tool(
    name="handoff_to_InvestmentAgent", description="Handoff to the investment-agent agent."
)
def handoff_to_investment_agent(context: str | None = None) -> str:
    """Transfer the conversation to the investment agent."""
    return "Handoff to InvestmentAgent"

class CustomHandoffAgentExecutor(HandoffAgentExecutor):
    """Custom executor with overridden handoff tool generation."""

    def _apply_auto_tools(self, agent: Agent, targets: Sequence[HandoffConfiguration]) -> None:
        default_options = agent.default_options
        existing_tools = list(default_options.get("tools") or [])
        existing_names = {getattr(tool, "name", "") for tool in existing_tools if hasattr(tool, "name")}

        new_tools: list[FunctionTool] = []
        for target in targets:
            tool = self._create_handoff_tool(target.target_id, target.description)
            if tool.name in existing_names:
                # Skip if handoff tool already exists
                continue
            new_tools.append(tool)

        if new_tools:
            default_options["tools"] = existing_tools + new_tools  # type: ignore[operator]
        else:
            default_options["tools"] = existing_tools

class CustomHandoffBuilder(HandoffBuilder):
    """Builder that uses the custom executor."""

    def _resolve_executors(
        self,
        agents: dict[str, SupportsAgentRun],
        handoffs: dict[str, list[HandoffConfiguration]],
    ) -> dict[str, HandoffAgentExecutor]:
        executors: dict[str, HandoffAgentExecutor] = {}

        for id, agent in agents.items():
            resolved_id = self._resolve_to_id(agent)
            autonomous_mode = self._autonomous_mode and (
                not self._autonomous_mode_enabled_agents or id in self._autonomous_mode_enabled_agents
            )

            executors[resolved_id] = CustomHandoffAgentExecutor(
                agent=agent,
                handoffs=handoffs.get(resolved_id, []),
                is_start_agent=(id == self._start_id),
                termination_condition=self._termination_condition,
                autonomous_mode=autonomous_mode,
                autonomous_mode_prompt=self._autonomous_mode_prompts.get(id, None),
                autonomous_mode_turn_limit=self._autonomous_mode_turn_limits.get(id, None),
            )

        return executors
    
class HandoffOrchestrator:
    
    triage_instructions = """
      You are a banking customer support agent triaging customer requests about their banking account, movements, payments,
      customer profile, loans, credit, documents, and communications.
      You have to evaluate the whole conversation with the customer and handoff to the right specialist agent.
      When delegation is required, call the matching handoff tool based on triage rules.


      # Triage rules
      - If the user request is related to bank account information like account balance, payment methods, cards and beneficiaries book you must call handoff_to_AccountAgent.
      - If the user request is related to banking movements and payments history, you must call handoff_to_TransactionHistoryAgent.
      - If the user request is related to initiate a payment request, upload a bill or invoice image for payment or manage an on-going payment process, you must call handoff_to_PaymentAgent.
      - If the user request is related to their customer profile, contact details, or (for admins) searching for other customers, you must call handoff_to_CustomerAgent.
      - If the user request is related to loan applications, loan status, EMI schedules, or (for admins) approving/rejecting loans, you must call handoff_to_LoanAgent.
      - If the user request is related to credit score or credit history, you must call handoff_to_CreditAgent.
      - If the user request is related to generating or retrieving a statement, receipt, or loan letter, you must call handoff_to_DocumentAgent.
      - If the user request is related to sending an email/WhatsApp/notification or viewing communication history, you must call handoff_to_CommunicationAgent.
      - If the user request is related to their stock investment portfolio, holdings, stock prices, or buying/selling stocks, you must call handoff_to_InvestmentAgent.
      - If the user request is not related to any of the above you must respond to the user that you are not able to help with the request.


    """

    """ A simple in-memory store [thread_id, CheckpointStorage] to keep track of workflow instances per user/session.
        In production, this should be replaced with a persistent store like a database or distributed cache.
    """
    thread_checkpoint_store: dict[str, CheckpointStorage] = {}
    checkpoint_storage = InMemoryCheckpointStorage()

    # HandoffOrchestrator is created fresh per HTTP request (DI Factory), so
    # without this cache, initialize() below rebuilt all 9 specialist agents
    # and reconnected every one of their MCP servers on EVERY single message
    # - confirmed live this cost ~20s of pure rebuild overhead per turn, on
    # top of the actual LLM/tool work. Caching per-thread (not globally)
    # keeps this safe: each thread's workflow is only ever run sequentially
    # within that thread (the framework's Workflow objects refuse concurrent
    # runs via an internal "already running" guard), and it's already paired
    # 1:1 with that thread's own CheckpointStorage from thread_checkpoint_store.
    thread_workflow_store: dict[str, Any] = {}

    # PERF-2026-08-19: thread_workflow_store above still means every brand-new
    # conversation pays the full ~20s agent-build cost once. That cost is
    # entirely MCP server connects for the 9 specialists + triage - none of it
    # is per-user state (identity is injected per-call via context providers,
    # never baked into the Agent object at build time), so it's safe to build
    # ONCE for the life of the process and share across every thread/user,
    # rather than once per thread. Only the Workflow graph itself (routing,
    # checkpoint wiring) needs to stay per-thread, since the framework refuses
    # to run one Workflow object concurrently - building that graph from
    # already-built agents is pure in-memory wiring, no I/O, effectively free.
    _participants: Any = None
    _participants_lock: asyncio.Lock = asyncio.Lock()

    def __init__(self,
                 azure_ai_client: FoundryChatClient,
                 account_agent: AccountAgent,
                 transaction_agent: TransactionHistoryAgent,
                 payment_agent: PaymentAgent,
                 customer_agent: CustomerAgent,
                 loan_agent: LoanAgent,
                 credit_agent: CreditAgent,
                 document_agent: DocumentAgent,
                 communication_agent: CommunicationAgent,
                 investment_agent: InvestmentAgent
                                ):
      self.azure_ai_client = azure_ai_client
      self.account_agent = account_agent
      self.transaction_agent = transaction_agent
      self.payment_agent = payment_agent
      self.customer_agent = customer_agent
      self.loan_agent = loan_agent
      self.credit_agent = credit_agent
      self.document_agent = document_agent
      self.communication_agent = communication_agent
      self.investment_agent = investment_agent
      self.workflow = None  # Will be initialized in async method

    async def _get_or_build_participants(self) -> tuple[Any, list[Any]]:
      """Builds TriageAgent + all 9 specialists (and connects all their MCP
      servers) once for the life of the process, then reuses that same set for
      every thread/user from then on - this is the genuinely expensive part
      (~20s, dominated by MCP server connects). None of it is per-user state:
      identity is injected per-call via context providers, never baked into an
      Agent object at build time, so sharing it globally is safe. Guarded by a
      lock so concurrent first-requests build one shared set instead of racing
      to build duplicates.
      """
      if HandoffOrchestrator._participants is not None:
          return HandoffOrchestrator._participants

      async with HandoffOrchestrator._participants_lock:
          if HandoffOrchestrator._participants is not None:
              return HandoffOrchestrator._participants

          all_handoff_tools = [
            handoff_to_account_agent,
            handoff_to_transaction_history_agent,
            handoff_to_payment_agent,
            handoff_to_customer_agent,
            handoff_to_loan_agent,
            handoff_to_credit_agent,
            handoff_to_document_agent,
            handoff_to_communication_agent,
            handoff_to_investment_agent,
          ]

          triage_agent = Agent(
                client=self.azure_ai_client,
                instructions=HandoffOrchestrator.triage_instructions,
                name="TriageAgent",
                tools=all_handoff_tools,
                # NoHistoryProvider prevents the framework from auto-injecting an
                # InMemoryHistoryProvider.  Inside a HandoffBuilder workflow the
                # executor already tracks the full conversation, so the auto-injected
                # provider would duplicate messages on every turn, eventually causing
                # OpenAI 400 errors due to mismatched tool_calls / tool results.
                context_providers=[NoHistoryProvider()]
            )

           # Register handoff tools in default_options so CustomHandoffBuilder sees them
          triage_agent.default_options["tools"] = all_handoff_tools

          # PERF-2026-08-18: tried building these 9 concurrently via asyncio.gather()
          # to cut the ~21s sequential wait - measured it working (initialize()
          # dropped to ~6s), but a live test then hit a severe LoanAgent failure
          # (looping "Let me connect you..." instead of a real answer/handoff) that
          # didn't reproduce this way when built sequentially. Reverted pending
          # investigation into whether concurrent build triggers a race in the
          # underlying MCP/Foundry client setup - do not re-enable without root-causing.
          account_agent = await self.account_agent.build_af_agent()
          transaction_agent = await self.transaction_agent.build_af_agent()
          payment_agent = await self.payment_agent.build_af_agent()
          customer_agent = await self.customer_agent.build_af_agent()
          loan_agent = await self.loan_agent.build_af_agent()
          credit_agent = await self.credit_agent.build_af_agent()
          document_agent = await self.document_agent.build_af_agent()
          communication_agent = await self.communication_agent.build_af_agent()
          investment_agent = await self.investment_agent.build_af_agent()

          specialists = [
              account_agent, transaction_agent, payment_agent,
              customer_agent, loan_agent, credit_agent, document_agent, communication_agent,
              investment_agent,
          ]

          HandoffOrchestrator._participants = (triage_agent, specialists)
          return HandoffOrchestrator._participants

    async def initialize(self, checkpoint_storage: CheckpointStorage, thread_id: str):
      """Build the workflow graph for this thread from the shared, already-built
      agents (see _get_or_build_participants) and cache it (see
      thread_workflow_store). Each thread gets its own Workflow object - the
      framework refuses to run one Workflow instance concurrently - but building
      the graph itself is pure in-memory wiring around already-built agents, no
      I/O, so doing this per-thread costs virtually nothing.
      """
      triage_agent, specialists = await self._get_or_build_participants()

      builder = (
        CustomHandoffBuilder(
            name="banking_assistant_handoff",
            participants=[triage_agent, *specialists],
            termination_condition=lambda conv: sum(1 for msg in conv if msg.role == "user") >= 20,
            checkpoint_storage=checkpoint_storage,
        )
        .with_start_agent(triage_agent)
        .add_handoff(triage_agent, specialists)  # Triage can hand off to any specialist
      )
      # Full mesh, not just hub-and-spoke back to Triage - confirmed live that a
      # specialist bouncing an out-of-domain request through Triage (e.g.
      # AccountAgent -> Triage -> PaymentAgent) sometimes stalls on the second
      # hop within the same turn instead of the target agent actually engaging.
      # Letting a specialist hand off directly to the specific specialist that
      # should own the request (when it can tell which one) removes that extra
      # hop entirely. Each specialist can still fall back to Triage when it
      # isn't sure which specialist is the right one.
      for specialist in specialists:
          other_specialists = [s for s in specialists if s is not specialist]
          builder = builder.add_handoff(specialist, [triage_agent, *other_specialists])

      self.workflow = builder.build()
      HandoffOrchestrator.thread_workflow_store[thread_id] = self.workflow

    async def _get_or_create_checkpoint_store(self,thread_id: str) -> CheckpointStorage :
        checkpoint_storage = HandoffOrchestrator.thread_checkpoint_store.get(thread_id, None)
        if checkpoint_storage is not None:
            return checkpoint_storage
        
        logger.info(f"Creating new checkpoint storage for thread_id: {thread_id}")
        checkpoint_storage = InMemoryCheckpointStorage()
        HandoffOrchestrator.thread_checkpoint_store[thread_id] = checkpoint_storage
        return checkpoint_storage
            
    
    async def _resume_workflow_with_response(self, checkpoint_storage: CheckpointStorage, checkpoint_id: str, user_message: str) -> AsyncIterable[WorkflowEvent]:
        """Resume a workflow from a checkpoint with a response to a RequestInfoEvent.

        Args:
            checkpoint (WorkflowCheckpoint): The checkpoint to resume from.
            response (dict[str, str]): The response mapping request IDs to user inputs.

        Yields:
            AsyncIterable[WorkflowEvent]: The events generated by resuming the workflow.
        """
        events = self.workflow.run(checkpoint_id=checkpoint_id, checkpoint_storage=checkpoint_storage, stream=True) #type: ignore
        
        responses: dict[str, object] = {}
        
        #We need to collect all workflow events otherwise we get concurrent workflow execution error when trying to resume.
        consumed_events = [event async for event in events]
        for event in consumed_events:
            if event.type == "request_info":
                if isinstance(event.data, HandoffAgentUserRequest):
                        responses[event.request_id] = HandoffAgentUserRequest.create_response(user_message)
                        return self.workflow.run(responses=responses, checkpoint_id=checkpoint_id, checkpoint_storage=checkpoint_storage, stream=True) #type: ignore
                else:
                    raise AgentFrameworkException(f"RequestInfoEvent [{event.request_id}] found in the checkpoint [{checkpoint_id}] that is not a HandoffAgentUserRequest.")
        #if we reach here, something went wrong. For this use case HandoffOrchestrator expected to always trigger a RequestInfoEvent.
        raise AgentFrameworkException(f"No RequestInfoEvent found in the checkpoint [{checkpoint_id}]")
            
    
    async def processMessageStream(self, user_message: str , thread_id : str ) -> AsyncGenerator[WorkflowEvent,None]:

        tracker = TurnTracker(thread_id, "message", user_message)
        checkpoint_storage = await self._get_or_create_checkpoint_store(thread_id)
        tracker.mark_checkpoint_ready()

        #Agents are initialized asynchronously due to the use of MCP tools. So we can't initialize the workflow in __init__. We do it lazily here.
        #Reuses the cached workflow for this thread if one already exists (see thread_workflow_store) instead of
        #rebuilding all 9 agents + reconnecting every MCP server on every single message.
        self.workflow = HandoffOrchestrator.thread_workflow_store.get(thread_id)
        was_cached = self.workflow is not None
        if self.workflow is None:
                await self.initialize(checkpoint_storage, thread_id)
        tracker.mark_workflow_ready(was_cached)

        checkpoint = None
        events = None

        # try to retrieve checkpoint for the given thread_id. If None, we start a new conversation.
        checkpoint = await checkpoint_storage.get_latest(workflow_name=self.workflow.name) # type: ignore
        workflow_id = self.workflow.id  # type: ignore

        try:
            if checkpoint is None:
                # Start a new conversation. This is the first user message.
                async for event in self.workflow.run(user_message, stream=True):# type: ignore
                    tracker.track(event)
                    yield event # type: ignore
            else:
                #Resuming an existing conversation.
                async for event in await self._resume_workflow_with_response(checkpoint_storage,checkpoint.checkpoint_id, user_message):
                    tracker.track(event)
                    yield event
        finally:
            tracker.finish()

    async def processToolApprovalResponse(self, thread_id: str, approved:bool, call_id: str, request_id: str, tool_name: str) -> AsyncGenerator[WorkflowEvent,None]:
        """Process a tool approval response from the user.

        Args:
            thread_id (str): The thread ID associated with the workflow.
            approved (bool): Whether the user approved the tool execution.

        """
        tracker = TurnTracker(thread_id, "approval_response")
        tracker.approval_tool = tool_name
        tracker.seed_call(call_id, tool_name)
        checkpoint_storage = await self._get_or_create_checkpoint_store(thread_id)
        tracker.mark_checkpoint_ready()

        self.workflow = HandoffOrchestrator.thread_workflow_store.get(thread_id)
        was_cached = self.workflow is not None
        if self.workflow is None:
               await self.initialize(checkpoint_storage, thread_id)
        tracker.mark_workflow_ready(was_cached)


        checkpoint = await checkpoint_storage.get_latest(workflow_name=self.workflow.name) # type: ignore
        if checkpoint is None:
            raise AgentFrameworkException(f"No checkpoint found for thread_id: {thread_id} when trying to process tool approval response")

        events = self.workflow.run(checkpoint_id=checkpoint.checkpoint_id, #type: ignore
                                   checkpoint_storage=checkpoint_storage, stream=True) #type: ignore

        try:
            responses: dict[str, object] = {}
            #restart the workflow to get the reference to FunctionApprovalRequestEvent
            consumed_events = [event async for event in events]
            for event in consumed_events:
                tracker.track(event)
                yield event
                if event.type == "request_info":
                    if isinstance(event.data, Content) and event.data.type == "function_approval_request":
                            responses[event.request_id] = event.data.to_function_approval_response(approved=approved)
                            async for event in self.workflow.run(responses=responses, checkpoint_id=checkpoint.checkpoint_id, checkpoint_storage=checkpoint_storage, stream=True) : #type: ignore
                                tracker.track(event)
                                yield event
                    else:
                        raise AgentFrameworkException(f"RequestInfoEvent [{event.request_id}] found in the checkpoint [{checkpoint.checkpoint_id}] that is not a HandoffUserInputRequest.")
        finally:
            tracker.finish()