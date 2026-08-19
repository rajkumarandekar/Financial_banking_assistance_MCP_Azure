"""Live, human-readable tail of logs/conversation_log.jsonl.

Polls the file for new lines (works fine on Windows, no OS-specific file
watcher needed) and pretty-prints each turn as it's written - question,
answer, agent path, tool calls with which microservice each hit, and timing.

Usage: uv run python tail_conversation_log.py
"""
import json
import sys
import time
from pathlib import Path

LOG_PATH = Path(__file__).resolve().parent / "logs" / "conversation_log.jsonl"


def _print_turn(rec: dict) -> None:
    kind = rec.get("kind", "message")
    ts = rec.get("timestamp", "")
    thread = (rec.get("thread_id") or "")[:8]
    dur = rec.get("duration_seconds")

    req_id = rec.get("request_id", "")
    print(f"\n{'='*70}")
    print(f"[{ts}] request={req_id} thread={thread}  {dur:.2f}s  ({kind})")

    if rec.get("user_message"):
        print(f"  USER: {rec['user_message']}")

    stages = rec.get("stages") or {}
    ckpt = stages.get("checkpoint_lookup_seconds")
    wf = stages.get("workflow_seconds")
    ai = stages.get("ai_work_seconds")
    if ckpt is not None or wf is not None or ai is not None:
        cached = stages.get("workflow_was_cached")
        wf_label = "workflow: reused (cached)" if cached else "workflow: BUILT FRESH"
        print(f"  STAGES: checkpoint={ckpt:.2f}s  {wf_label}={wf:.2f}s  ai_work={ai:.2f}s")

    retry_count = rec.get("retry_count", 0)
    handoff_count = rec.get("handoff_count", 0)
    llm_calls = rec.get("llm_call_count", 0)
    flag = "  ⚠ REPEATED TOOL CALLS" if retry_count else ""
    print(f"  COUNTS: llm_calls={llm_calls}  handoffs={handoff_count}  retries={retry_count}{flag}")

    path = rec.get("agent_path") or []
    locations = rec.get("agent_locations") or {}
    if path:
        print(f"  AGENTS: {' -> '.join(path)}")
        for agent in path:
            loc = locations.get(agent)
            if loc:
                print(f"    {agent}: {loc}")

    for t in rec.get("tool_calls") or []:
        dur_str = f"  ({t['duration_seconds']:.2f}s)" if "duration_seconds" in t else ""
        print(f"  TOOL:   {t['tool']} -> {t['service']}-service (via {t['agent']}){dur_str}")
        if t.get("location"):
            print(f"    {t['location']}")

    if rec.get("paused_for_approval"):
        print(f"  APPROVAL GATE: {rec.get('approval_tool')}")

    answer = (rec.get("assistant_response") or "").strip()
    if answer:
        print(f"  ANSWER: {answer}")
    print(f"{'='*70}")


def main() -> None:
    print(f"Watching {LOG_PATH} ... (Ctrl+C to stop)")
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not LOG_PATH.exists():
        LOG_PATH.touch()

    with LOG_PATH.open("r", encoding="utf-8") as f:
        f.seek(0, 2)  # start at end - only show new turns from now on
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.5)
                continue
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            _print_turn(rec)
            sys.stdout.flush()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
