"""Per-thread LLM/tool observability, sourced from the Application Insights
telemetry the agent framework already emits (gen_ai.* span attributes via
`enable_instrumentation()` in main_chatkit_server.py) - no separate
instrumentation needed, just a Log Analytics query keyed by thread id.

The root span for every turn is named "Banking Assistant - {thread_id}"
(see chatkit_server.py's `get_tracer().start_as_current_span(...)`); every
LLM call ("chat <model>"), tool execution ("execute_tool <name>") and agent
invocation ("invoke_agent <name>") span for that turn shares its OperationId,
so a two-step query (find the OperationIds, then pull every span under them)
reconstructs the full call graph for a conversation.
"""

import json
import logging
from datetime import timedelta
from typing import Any

from azure.monitor.query.aio import LogsQueryClient
from azure.monitor.query import LogsQueryStatus

from app.config.azure_credential import get_async_azure_credential
from app.config.settings import settings

logger = logging.getLogger(__name__)

# tool name (as declared via @mcp.tool(name=...)) -> owning business-api service.
# Built directly from each service's mcp_tools.py; anything not listed here
# (e.g. a future tool) falls back to "unknown" rather than a guess.
TOOL_SERVICE_MAP: dict[str, str] = {
    "getAccountsByUserName": "account", "getAccountDetails": "account",
    "getRegisteredBeneficiary": "account", "getCreditCards": "account",
    "getCardDetails": "account", "freezeCard": "account", "unfreezeCard": "account",
    "unblockCard": "account", "closeCard": "account", "payWithCard": "account",
    "rechargeCard": "account", "getCardSecuritySettings": "account",
    "updateCardSecuritySettings": "account", "requestCardLimitIncrease": "account",
    "issueCard": "account",
    "getTransactionsByRecipientName": "transaction", "getCardTransactions": "transaction",
    "getLastTransactions": "transaction",
    "processPayment": "payment", "getPaymentsByCustomer": "payment",
    "getPaymentSummary": "payment", "getPaymentStatus": "payment",
    "cancelPayment": "payment", "retryPayment": "payment",
    "applyLoan": "loan", "getLoans": "loan", "getLoanDetails": "loan",
    "getEmiSchedule": "loan", "approveLoan": "loan", "rejectLoan": "loan",
    "payEmi": "loan", "makeExtraPayment": "loan",
    "getCreditScore": "credit", "getCreditHistory": "credit",
    "generateStatement": "document", "generateReceipt": "document",
    "generateLoanLetter": "document", "getDocument": "document",
    "getDocumentAsPdf": "document", "listDocuments": "document",
    "sendEmail": "communication", "sendWhatsapp": "communication",
    "sendNotification": "communication", "getCommunicationHistory": "communication",
    "getHoldings": "investment", "getStockPrices": "investment",
    "buyStock": "investment", "sellStock": "investment",
    "refreshStockPrices": "investment",
    "getCustomerProfile": "customer", "searchCustomers": "customer",
    "updateContactDetails": "customer",
}

# Published per-1M-token rates (USD) for the deployed model. These are list
# prices, not the account's actual negotiated/metered rate - the cost figures
# derived from them are estimates for relative comparison, not a real invoice.
MODEL_PRICING_USD_PER_1M: dict[str, tuple[float, float]] = {
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
}
DEFAULT_PRICING_USD_PER_1M = (2.00, 8.00)
USD_TO_INR = 83.0


def _estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = MODEL_PRICING_USD_PER_1M.get(model, DEFAULT_PRICING_USD_PER_1M)
    return (input_tokens / 1_000_000) * in_rate + (output_tokens / 1_000_000) * out_rate


def _parse_properties(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return {}


async def get_thread_telemetry(thread_id: str) -> dict[str, Any]:
    """Query Application Insights (via the shared Log Analytics workspace) for
    every LLM call and tool execution recorded for this thread's turns.

    Returns an empty-but-well-formed result (rather than raising) when the
    workspace isn't configured or the query fails, since this is a secondary
    enrichment on top of the always-available ChatKit-derived metrics.
    """
    empty: dict[str, Any] = {
        "llm_calls": [], "tool_executions": [], "agents_invoked": [],
        "total_llm_calls": 0, "total_input_tokens": 0, "total_output_tokens": 0,
        "total_tokens": 0, "estimated_cost_usd": 0.0, "estimated_cost_inr": 0.0,
        "models_used": [], "service_breakdown": {},
    }

    if not settings.LOG_ANALYTICS_WORKSPACE_ID:
        return empty

    credential = get_async_azure_credential()
    try:
        client = LogsQueryClient(credential)
        try:
            root_query = (
                "AppDependencies "
                "| where TimeGenerated > ago(30d) "
                f"| where Name == 'Banking Assistant - {thread_id}' "
                "| project OperationId"
            )
            root_result = await client.query_workspace(
                settings.LOG_ANALYTICS_WORKSPACE_ID, root_query, timespan=timedelta(days=30)
            )
            if root_result.status != LogsQueryStatus.SUCCESS or not root_result.tables[0].rows:
                return empty

            operation_ids = sorted({row[0] for row in root_result.tables[0].rows})
            id_list = ", ".join(f"'{op_id}'" for op_id in operation_ids)

            spans_query = (
                "AppDependencies "
                "| where TimeGenerated > ago(30d) "
                f"| where OperationId in ({id_list}) "
                "| where Name startswith 'chat ' or Name startswith 'execute_tool ' or Name startswith 'invoke_agent ' "
                "| project TimeGenerated, Name, DurationMs, Properties "
                "| order by TimeGenerated asc"
            )
            spans_result = await client.query_workspace(
                settings.LOG_ANALYTICS_WORKSPACE_ID, spans_query, timespan=timedelta(days=30)
            )
            if spans_result.status != LogsQueryStatus.SUCCESS:
                return empty

            llm_calls: list[dict[str, Any]] = []
            tool_executions: list[dict[str, Any]] = []
            agents_invoked: list[dict[str, Any]] = []
            models_used: set[str] = set()
            service_breakdown: dict[str, int] = {}
            total_input = 0
            total_output = 0
            total_cost_usd = 0.0

            for row in spans_result.tables[0].rows:
                at, name, duration_ms, props_raw = row
                props = _parse_properties(props_raw)

                if name.startswith("chat "):
                    model = props.get("gen_ai.request.model", name.removeprefix("chat ").strip())
                    input_tokens = int(props.get("gen_ai.usage.input_tokens", 0) or 0)
                    output_tokens = int(props.get("gen_ai.usage.output_tokens", 0) or 0)
                    cost_usd = _estimate_cost_usd(model, input_tokens, output_tokens)
                    total_input += input_tokens
                    total_output += output_tokens
                    total_cost_usd += cost_usd
                    models_used.add(model)
                    llm_calls.append({
                        "at": at.isoformat() if hasattr(at, "isoformat") else str(at),
                        "model": model,
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "duration_ms": int(duration_ms or 0),
                        "finish_reason": (json.loads(props.get("gen_ai.response.finish_reasons", "[]") or "[]") or [None])[0],
                        "estimated_cost_inr": round(cost_usd * USD_TO_INR, 4),
                    })
                elif name.startswith("execute_tool "):
                    tool_name = name.removeprefix("execute_tool ").strip()
                    service = TOOL_SERVICE_MAP.get(tool_name, "unknown")
                    service_breakdown[service] = service_breakdown.get(service, 0) + 1
                    tool_executions.append({
                        "at": at.isoformat() if hasattr(at, "isoformat") else str(at),
                        "tool_name": tool_name,
                        "service": service,
                        "duration_ms": int(duration_ms or 0),
                    })
                elif name.startswith("invoke_agent "):
                    agents_invoked.append({
                        "at": at.isoformat() if hasattr(at, "isoformat") else str(at),
                        "agent_name": props.get("gen_ai.agent.name", name.removeprefix("invoke_agent ").strip()),
                        "model": props.get("gen_ai.request.model"),
                        "duration_ms": int(duration_ms or 0),
                    })

            return {
                "llm_calls": llm_calls,
                "tool_executions": tool_executions,
                "agents_invoked": agents_invoked,
                "total_llm_calls": len(llm_calls),
                "total_input_tokens": total_input,
                "total_output_tokens": total_output,
                "total_tokens": total_input + total_output,
                "estimated_cost_usd": round(total_cost_usd, 4),
                "estimated_cost_inr": round(total_cost_usd * USD_TO_INR, 2),
                "models_used": sorted(models_used),
                "service_breakdown": service_breakdown,
            }
        finally:
            await client.close()
    except Exception as e:
        logger.warning(f"Telemetry query failed for thread {thread_id}: {e}", exc_info=True)
        return empty
    finally:
        await credential.close()
