"""Drives the real HandoffOrchestrator directly - same agents, same MCP
servers, same DB - just skipping the ChatKit HTTP/SSE transport layer, which
is OpenAI SDK boilerplate, not the part under test.

Multi-turn: pass multiple messages, each as a separate CLI arg, to exercise
one conversation across several turns within a single process (the
checkpoint store is in-memory and process-local, matching how the real
long-running server keeps it alive across turns of the same conversation).

If a turn hits a real approval gate (framework-level `function_approval_request`,
e.g. processPayment/approveLoan/sendEmail), this auto-approves it the same
way chatkit_server.py's action handler does for a real "Approve" click, so a
multi-turn payment test can run unattended to completion.
"""
import asyncio
import io
import sys
import uuid

sys.path.insert(0, ".")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from agent_framework import Content  # noqa: E402
from app.config.settings import settings  # noqa: E402

if settings.AGENTS_TYPE == "azure_chat":
    from app.config.container_azure_chat import Container  # noqa: E402
elif settings.AGENTS_TYPE == "foundry_v2":
    from app.config.container_foundry_v2 import Container  # noqa: E402
else:
    raise ValueError(f"Unsupported AGENTS_TYPE: {settings.AGENTS_TYPE}")


def _print_event(event, state):
    data = getattr(event, "data", None)
    executor_id = getattr(event, "executor_id", None)

    if executor_id and executor_id != state["agent"]:
        if state["text"]:
            print(f"\n{state['agent']}: {state['text']}")
        state["agent"] = executor_id
        state["text"] = ""

    contents = getattr(data, "contents", None) or []
    for c in contents:
        ctype = getattr(c, "type", None)
        if ctype == "text":
            state["text"] += getattr(c, "text", "")
        elif ctype == "function_result":
            print(f"  [{executor_id} TOOL RESULT] {str(getattr(c, 'result', None))[:400]}")
        elif ctype == "function_approval_request":
            fc = getattr(c, "function_call", None)
            state["approval"] = (state["approval"] or {}) | {
                "call_id": getattr(fc, "call_id", None) or getattr(c, "id", None),
                "tool_name": getattr(fc, "name", None),
                "arguments": getattr(fc, "arguments", None),
            }
            print(f"  [APPROVAL GATE] tool={state['approval']['tool_name']} args={state['approval']['arguments']}")


async def send(orchestrator, message, thread_id):
    print(f"\nUSER: {message}")
    print("-" * 60)
    state = {"agent": None, "text": "", "approval": None}

    async for event in orchestrator.processMessageStream(message, thread_id):
        if getattr(event, "type", None) == "request_info" and isinstance(getattr(event, "data", None), Content):
            state["approval"] = state["approval"] or {}
            data = event.data
            fc = getattr(data, "function_call", None)
            state["approval"].update({
                "call_id": getattr(fc, "call_id", None),
                "request_id": event.request_id,
                "tool_name": getattr(fc, "name", None),
                "arguments": getattr(fc, "arguments", None),
                "content": data,
            })
            print(f"  [APPROVAL GATE via request_info] tool={state['approval']['tool_name']} args={state['approval']['arguments']}")
        else:
            _print_event(event, state)

    if state["text"]:
        print(f"\n{state['agent']}: {state['text']}")

    if state["approval"]:
        print(f"\n>>> AUTO-APPROVING: {state['approval']['tool_name']}({state['approval']['arguments']})")
        async for event in orchestrator.processToolApprovalResponse(
            thread_id, True,
            call_id=state["approval"]["call_id"],
            request_id=state["approval"]["request_id"],
            tool_name=state["approval"]["tool_name"],
        ):
            _print_event(event, state)
        if state["text"]:
            print(f"\n{state['agent']}: {state['text']}")


async def main():
    messages = sys.argv[1:] or ["What is my account balance?"]
    thread_id = str(uuid.uuid4())
    print(f"THREAD: {thread_id}")

    container = Container()
    orchestrator = container.handoff_orchestrator_chatkit()

    for msg in messages:
        await send(orchestrator, msg, thread_id)

    print("\n" + "-" * 60)
    print("DONE")


if __name__ == "__main__":
    asyncio.run(main())
