import logging
from fastapi import APIRouter, Depends
from starlette.responses import JSONResponse
from dependency_injector.wiring import Provide, inject

from app.config.settings import settings

if settings.AGENTS_TYPE == "azure_chat":
    from app.config.container_azure_chat import Container
elif settings.AGENTS_TYPE == "foundry_v2":
    from app.config.container_foundry_v2 import Container
else:
    raise ValueError(f"Unsupported AGENTS_TYPE: {settings.AGENTS_TYPE}")

from app.helpers.user_profile_helper import UserProfileHelper
from app.helpers.telemetry_metrics import get_thread_telemetry
from .sqllite_store import SQLiteStore
from .cosmosdb_store import CosmosDBStore

router = APIRouter()
logger = logging.getLogger(__name__)

_fallback_sqlite_store = SQLiteStore()


def _resolve_store(cosmosdb_store: CosmosDBStore | None):
    return cosmosdb_store if cosmosdb_store is not None else _fallback_sqlite_store


# Fields that are internal plumbing - never useful in a metrics view.
_HIDDEN_ARG_FIELDS = {
    "callerCustomerId", "callerRole", "customerId", "customer_id",
    "attachmentBase64", "call_id", "request_id",
}


def _redact_args(arguments: dict) -> dict:
    return {k: v for k, v in (arguments or {}).items() if k not in _HIDDEN_ARG_FIELDS}


@router.get("/threads/{thread_id}/metrics")
@inject
async def get_thread_metrics(
    thread_id: str,
    cosmosdb_store: CosmosDBStore = Depends(Provide[Container.cosmosdb_store]),
):
    """Return a metrics breakdown (agent path, tool calls, timing) for a single chat thread.

    Built entirely from the ChatKit thread items already persisted per turn -
    no separate telemetry pipeline needed, since every task/tool-call/message
    item already carries a timestamp and the agent/tool name that produced it.
    """
    store = _resolve_store(cosmosdb_store)
    context = {"user_id": UserProfileHelper.get_user_id()}

    try:
        thread = await store.load_thread(thread_id, context)
    except Exception as e:
        logger.warning(f"Could not load thread {thread_id} for metrics: {e}")
        return JSONResponse(status_code=404, content={"error": f"Thread {thread_id} not found"})

    items = []
    after = None
    while True:
        page = await store.load_thread_items(thread_id, after, 100, "asc", context)
        items.extend(page.data)
        if not page.has_more or not page.data:
            break
        after = page.data[-1].id

    telemetry = await get_thread_telemetry(thread_id)

    if not items:
        return JSONResponse(content={
            "thread_id": thread_id,
            "title": thread.title,
            "created_at": thread.created_at.isoformat(),
            "turn_count": 0,
            "total_duration_ms": 0,
            "agent_path": [],
            "tool_calls": [],
            "timeline": [],
            **telemetry,
        })

    timestamps = [item.created_at for item in items]
    total_duration_ms = int((max(timestamps) - min(timestamps)).total_seconds() * 1000)

    agent_path: list[str] = []
    tool_calls: list[dict] = []
    timeline: list[dict] = []
    user_turns = 0
    assistant_turns = 0
    errors = 0

    prev_ts = None
    for item in items:
        step_latency_ms = int((item.created_at - prev_ts).total_seconds() * 1000) if prev_ts else 0
        prev_ts = item.created_at

        if item.type == "user_message":
            user_turns += 1
            timeline.append({"type": "user_message", "at": item.created_at.isoformat(), "step_latency_ms": step_latency_ms})

        elif item.type == "assistant_message":
            assistant_turns += 1
            timeline.append({"type": "assistant_message", "at": item.created_at.isoformat(), "step_latency_ms": step_latency_ms})

        elif item.type == "task":
            task = item.task
            title = getattr(task, "title", None) or getattr(task, "content", None) or "Task"
            if not agent_path or agent_path[-1] != title:
                agent_path.append(title)
            timeline.append({"type": "task", "title": title, "at": item.created_at.isoformat(), "step_latency_ms": step_latency_ms})

        elif item.type == "client_tool_call":
            tool_calls.append({
                "name": item.name,
                "status": item.status,
                "arguments": _redact_args(item.arguments),
                "at": item.created_at.isoformat(),
                "step_latency_ms": step_latency_ms,
            })
            timeline.append({"type": "tool_call", "name": item.name, "status": item.status, "at": item.created_at.isoformat(), "step_latency_ms": step_latency_ms})

        elif item.type == "client_widget" and item.name == "tool_approval_request":
            timeline.append({"type": "approval_request", "tool_name": (item.args or {}).get("tool_name"), "at": item.created_at.isoformat(), "step_latency_ms": step_latency_ms})

    # Server-side MCP tool calls never show up as ChatKit items (those only
    # cover client-managed widgets/approvals) - the telemetry-derived
    # executions are the only record of them, so fold them into the same
    # timeline/tool_calls views the frontend already renders.
    for call in telemetry["llm_calls"]:
        timeline.append({"type": "llm_call", "model": call["model"], "at": call["at"], "step_latency_ms": call["duration_ms"]})
    for exe in telemetry["tool_executions"]:
        timeline.append({"type": "tool_execution", "name": exe["tool_name"], "service": exe["service"], "at": exe["at"], "step_latency_ms": exe["duration_ms"]})
        tool_calls.append({"name": exe["tool_name"], "service": exe["service"], "status": "completed", "arguments": {}, "at": exe["at"], "step_latency_ms": exe["duration_ms"]})

    timeline.sort(key=lambda e: e["at"])

    return JSONResponse(content={
        "thread_id": thread_id,
        "title": thread.title,
        "created_at": thread.created_at.isoformat(),
        "turn_count": user_turns,
        "assistant_turn_count": assistant_turns,
        "total_duration_ms": total_duration_ms,
        "tool_call_count": len(tool_calls),
        "error_count": errors,
        "agent_path": agent_path,
        "tool_calls": tool_calls,
        "timeline": timeline,
        **telemetry,
    })
