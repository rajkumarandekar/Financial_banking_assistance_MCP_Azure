"""Local structured logging of chat conversation turns.

Answers "what did the user ask, what did we answer, how long did it take,
which agents/tools were involved" without needing Application Insights
configured - writes one JSON line per turn to a local file.

Independent of Python's stdlib logging/OpenTelemetry: those are wired up too
(see main_chatkit_server.py) but only export anywhere when
APPLICATIONINSIGHTS_CONNECTION_STRING is set. This always writes locally.
"""

import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]  # app/backend
REPO_ROOT = BACKEND_DIR.parent.parent  # strip "app/backend"

LOG_PATH = Path(
    os.environ.get(
        "CONVERSATION_LOG_PATH",
        BACKEND_DIR / "logs" / "conversation_log.jsonl",
    )
)

# Source location of each agent's class definition (foundry_v2 tree - the
# active AGENTS_TYPE). Lets a log line double as a "jump to the code that
# handled this" pointer: printed as file:line, VS Code's integrated terminal
# turns that into a clickable link on its own.
_AGENTS_DIR = REPO_ROOT / "app" / "backend" / "app" / "agents" / "foundry_v2"
AGENT_TO_LOCATION: dict[str, str] = {
    "TriageAgent": f"{_AGENTS_DIR / 'handoff_orchestrator.py'}:222",
    "AccountAgent": f"{_AGENTS_DIR / 'account_agent.py'}:18",
    "TransactionHistoryAgent": f"{_AGENTS_DIR / 'transaction_agent.py'}:17",
    "PaymentAgent": f"{_AGENTS_DIR / 'payment_agent.py'}:19",
    "CustomerAgent": f"{_AGENTS_DIR / 'customer_agent.py'}:18",
    "LoanAgent": f"{_AGENTS_DIR / 'loan_agent.py'}:18",
    "CreditAgent": f"{_AGENTS_DIR / 'credit_agent.py'}:18",
    "DocumentAgent": f"{_AGENTS_DIR / 'document_agent.py'}:18",
    "CommunicationAgent": f"{_AGENTS_DIR / 'communication_agent.py'}:18",
    "InvestmentAgent": f"{_AGENTS_DIR / 'investment_agent.py'}:18",
}

# Source location of each MCP tool's handler function, one mcp_tools.py per
# microservice. (service, line) - file is always that service's mcp_tools.py.
_SERVICES_DIR = REPO_ROOT / "app" / "business-api" / "python"
TOOL_TO_LINE: dict[str, tuple[str, int]] = {
    # account-service (port 8070)
    "getAccountsByUserName": ("account", 28),
    "getAccountDetails": ("account", 42),
    "getRegisteredBeneficiary": ("account", 58),
    "getCreditCards": ("account", 75),
    "getCardDetails": ("account", 93),
    "freezeCard": ("account", 128),
    "unfreezeCard": ("account", 142),
    "unblockCard": ("account", 156),
    "closeCard": ("account", 170),
    "payWithCard": ("account", 184),
    "rechargeCard": ("account", 199),
    "getCardSecuritySettings": ("account", 214),
    "updateCardSecuritySettings": ("account", 236),
    "requestCardLimitIncrease": ("account", 272),
    "issueCard": ("account", 293),
    # transaction-service (port 8071)
    "getTransactionsByRecipientName": ("transaction", 30),
    "getCardTransactions": ("transaction", 45),
    "getLastTransactions": ("transaction", 60),
    # payment-service (port 8072)
    "processPayment": ("payment", 41),
    "getPaymentsByCustomer": ("payment", 111),
    "getPaymentSummary": ("payment", 126),
    "getPaymentStatus": ("payment", 185),
    "cancelPayment": ("payment", 200),
    "retryPayment": ("payment", 216),
    # customer-service (port 8073)
    "getCustomerProfile": ("customer", 25),
    "searchCustomers": ("customer", 39),
    "updateContactDetails": ("customer", 54),
    # loan-service (port 8074)
    "applyLoan": ("loan", 25),
    "getLoans": ("loan", 44),
    "getLoanDetails": ("loan", 58),
    "getEmiSchedule": ("loan", 74),
    "approveLoan": ("loan", 90),
    "rejectLoan": ("loan", 105),
    "payEmi": ("loan", 121),
    "makeExtraPayment": ("loan", 136),
    # credit-service (port 8075)
    "getCreditScore": ("credit", 25),
    "getCreditHistory": ("credit", 39),
    # document-service (port 8076)
    "generateStatement": ("document", 32),
    "generateReceipt": ("document", 70),
    "generateLoanLetter": ("document", 109),
    "getDocument": ("document", 162),
    "listDocuments": ("document", 177),
    # communication-service (port 8077)
    "sendEmail": ("communication", 31),
    "sendWhatsapp": ("communication", 52),
    "sendNotification": ("communication", 72),
    "getCommunicationHistory": ("communication", 91),
    # investment-service (port 8078)
    "getHoldings": ("investment", 26),
    "getStockPrices": ("investment", 41),
    "buyStock": ("investment", 59),
    "sellStock": ("investment", 78),
    "refreshStockPrices": ("investment", 94),
}


def _tool_service_and_location(tool_name: str) -> tuple[str, str | None]:
    """Returns (service, 'file:line' or None) for a tool name."""
    if tool_name.startswith("handoff_to_"):
        return "handoff", None
    entry = TOOL_TO_LINE.get(tool_name)
    if entry is None:
        return "unknown", None
    service, line = entry
    return service, f"{_SERVICES_DIR / service / 'mcp_tools.py'}:{line}"


class TurnTracker:
    """Consumes the WorkflowEvent stream for one processMessageStream (or
    processToolApprovalResponse) call and writes one JSON log line when done.

    Call .track(event) for every event as it's yielded, then .finish() once
    the stream is exhausted - designed to sit in a try/finally around the
    orchestrator's event loop so it always fires, even if the caller stops
    consuming early or the request pauses for a tool-approval gate.
    """

    def __init__(self, thread_id: str, kind: str, user_message: str | None = None):
        self.request_id = uuid.uuid4().hex[:12]
        self.thread_id = thread_id
        self.kind = kind  # "message" | "approval_response"
        self.user_message = user_message
        self.start = time.monotonic()
        self.agent_path: list[str] = []
        self.tool_calls: list[dict[str, Any]] = []
        self._pending_call_names: dict[str, str] = {}
        self._pending_call_started: dict[str, float] = {}
        self._logged_call_ids: set[str] = set()
        self._text_agent: str | None = None
        self.current_text = ""
        self.paused_for_approval = False
        self.approval_tool: str | None = None
        # llm_call_count is an approximation: one per tool call actually
        # invoked, plus one per agent that produced a text reply - there's no
        # direct signal for "the model was invoked" in the WorkflowEvent
        # stream itself, so this counts the observable outcomes of each call
        # instead (a tool decision or a text answer) rather than raw API hits.
        self.llm_call_count = 0
        self._counted_text_agents: set[str] = set()
        # Stage timings - who ate the total duration. checkpoint_seconds and
        # workflow_seconds are set via mark_checkpoint_ready/mark_workflow_ready
        # as the orchestrator passes each stage; ai_work_seconds is whatever's
        # left once finish() runs (the actual LLM + tool-call round trips).
        self.checkpoint_seconds: float | None = None
        self.workflow_seconds: float | None = None
        self.workflow_was_cached: bool | None = None
        self._last_stage_mark = self.start

    def mark_checkpoint_ready(self) -> None:
        """Call right after _get_or_create_checkpoint_store() returns."""
        now = time.monotonic()
        self.checkpoint_seconds = round(now - self._last_stage_mark, 3)
        self._last_stage_mark = now

    def mark_workflow_ready(self, was_cached: bool) -> None:
        """Call right after the per-thread workflow is available (cache hit or freshly built)."""
        now = time.monotonic()
        self.workflow_seconds = round(now - self._last_stage_mark, 3)
        self.workflow_was_cached = was_cached
        self._last_stage_mark = now

    def seed_call(self, call_id: str | None, tool_name: str | None) -> None:
        """Pre-register a known call_id -> tool name mapping.

        Needed for the approval-response flow: the original function_call
        chunks (which carry the name) were seen by a *previous* TurnTracker
        instance during the message turn that triggered the approval gate,
        not this one - but the caller already knows call_id/tool_name from
        the approval request itself, so seed it here rather than losing the
        tool name when the matching function_result shows up in this turn.
        """
        if call_id and tool_name:
            self._pending_call_names[call_id] = tool_name

    def track(self, event: Any) -> None:
        if getattr(event, "type", None) == "request_info":
            data = getattr(event, "data", None)
            if getattr(data, "type", None) == "function_approval_request":
                fc = getattr(data, "function_call", None)
                self.paused_for_approval = True
                self.approval_tool = getattr(fc, "name", None)
            return

        data = getattr(event, "data", None)
        contents = getattr(data, "contents", None) or []
        if not contents:
            # Several workflow lifecycle events (e.g. per-executor
            # start/stop bookkeeping) carry an executor_id but no real
            # content - every agent in the graph gets one of these even if
            # it never actually ran. Skip them entirely so agent_path only
            # reflects agents that did something, and so a late no-op event
            # for an unrelated agent can't wipe out text we already
            # accumulated for the agent that actually answered.
            return

        executor_id = getattr(event, "executor_id", None)
        if executor_id and executor_id not in self.agent_path:
            self.agent_path.append(executor_id)

        for c in contents:
            ctype = getattr(c, "type", None)
            if ctype == "text":
                if executor_id != self._text_agent:
                    self._text_agent = executor_id
                    self.current_text = ""
                    if executor_id not in self._counted_text_agents:
                        self._counted_text_agents.add(executor_id)
                        self.llm_call_count += 1
                self.current_text += getattr(c, "text", None) or ""
            elif ctype == "function_call":
                call_id = getattr(c, "call_id", None)
                name = getattr(c, "name", None)
                if call_id and name:
                    if call_id not in self._pending_call_names:
                        self.llm_call_count += 1
                    self._pending_call_names[call_id] = name
                    # function_call streams in repeated chunks (same call_id) as
                    # the model generates its arguments token by token - only
                    # record the start time on the first chunk we see.
                    self._pending_call_started.setdefault(call_id, time.monotonic())
            elif ctype == "function_result":
                call_id = getattr(c, "call_id", None)
                if call_id and call_id not in self._logged_call_ids:
                    self._logged_call_ids.add(call_id)
                    tool_name = self._pending_call_names.get(call_id, "unknown")
                    service, location = _tool_service_and_location(tool_name)
                    entry = {
                        "agent": executor_id,
                        "tool": tool_name,
                        "service": service,
                    }
                    if location:
                        entry["location"] = location
                    started = self._pending_call_started.get(call_id)
                    if started is not None:
                        entry["duration_seconds"] = round(time.monotonic() - started, 3)
                    self.tool_calls.append(entry)
            elif ctype == "function_approval_request":
                fc = getattr(c, "function_call", None)
                self.paused_for_approval = True
                self.approval_tool = getattr(fc, "name", None)

    def finish(self) -> None:
        now = time.monotonic()
        total = round(now - self.start, 3)
        # Whatever's left after checkpoint lookup + workflow build/cache-hit is
        # the actual AI work: LLM completions + tool-call round trips.
        ai_work_seconds = round(max(now - self._last_stage_mark, 0), 3) if (
            self.checkpoint_seconds is not None or self.workflow_seconds is not None
        ) else None

        handoff_count = sum(1 for t in self.tool_calls if t["tool"].startswith("handoff_to_"))
        # Consecutive identical (agent, tool) calls in a row - the exact
        # pattern behind the getLoans x3 loop this was built to catch.
        retry_count = 0
        for i in range(1, len(self.tool_calls)):
            prev, cur = self.tool_calls[i - 1], self.tool_calls[i]
            if prev["tool"] == cur["tool"] and prev["agent"] == cur["agent"]:
                retry_count += 1

        record: dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "request_id": self.request_id,
            "thread_id": self.thread_id,
            "kind": self.kind,
            "duration_seconds": total,
            "stages": {
                "checkpoint_lookup_seconds": self.checkpoint_seconds,
                "workflow_seconds": self.workflow_seconds,
                "workflow_was_cached": self.workflow_was_cached,
                "ai_work_seconds": ai_work_seconds,
            },
            "agent_path": self.agent_path,
            "agent_locations": {a: AGENT_TO_LOCATION[a] for a in self.agent_path if a in AGENT_TO_LOCATION},
            "tool_calls": self.tool_calls,
            "retry_count": retry_count,
            "handoff_count": handoff_count,
            "llm_call_count": self.llm_call_count,
            "paused_for_approval": self.paused_for_approval,
        }
        if self.approval_tool:
            record["approval_tool"] = self.approval_tool
        if self.user_message is not None:
            record["user_message"] = self.user_message
        record["assistant_response"] = self.current_text
        try:
            LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with LOG_PATH.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
        except OSError:
            logger.exception("Failed to write conversation log entry to %s", LOG_PATH)
