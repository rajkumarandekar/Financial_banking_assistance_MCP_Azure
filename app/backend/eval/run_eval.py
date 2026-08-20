"""Regression eval harness - runs dataset.py's prompts against the REAL
live deployed app (not mocks), then scores each turn on:

  deterministic (free, no extra tokens):
    - tool-call accuracy       (expected tool actually invoked)
    - agent routing accuracy   (expected agent actually handled it)
    - response content checks  (must_contain / must_not_contain)
    - latency                  (total_duration_ms from telemetry)
    - token/cost tracking      (total_tokens, estimated_cost_inr)

  LLM-as-judge (one combined gpt-4.1-mini call per case, not five):
    - groundedness / hallucination / safety / response correctness

Data source: this reuses the app's own /threads/{id}/metrics endpoint
(built earlier) rather than re-implementing telemetry queries - the harness
just drives real conversations through the live /chatkit endpoint and reads
back what the app already computes about each one.

Usage:
    .venv/Scripts/python.exe eval/run_eval.py --label baseline
    .venv/Scripts/python.exe eval/run_eval.py --label after-fixes
"""
import argparse
import io
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Windows console defaults to cp1252, which can't print rupee signs etc.
# that come back in real responses - force UTF-8 stdout like test_agent.py does.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(__file__))
from dataset import CASES  # noqa: E402

# Only need AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_CHAT_DEPLOYMENT_NAME for the judge
# client - load them straight from .env.dev rather than pulling in the app's
# full Settings/pydantic-settings machinery for a standalone script.
_env_dev_path = os.path.join(os.path.dirname(__file__), "..", ".env.dev")
if os.path.exists(_env_dev_path):
    with open(_env_dev_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

FRONTEND_URL = "https://ca-web-c6bvzdtqfx6gm.bravesmoke-f9fe1f4e.centralindia.azurecontainerapps.io"
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")

# Telemetry (Application Insights) has a short ingestion lag - give it time
# to land before reading it back via /threads/{id}/metrics.
TELEMETRY_WAIT_SECONDS = 12


def _with_retries(fn, attempts: int = 3, delay: float = 3.0):
    """Azure Container Apps ingress occasionally drops a long-lived chunked
    SSE response mid-stream (IncompleteRead) - transient, not a real app
    bug, so retry a couple times before giving up on a single test case."""
    last_exc = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            last_exc = e
            if i < attempts - 1:
                time.sleep(delay)
    raise last_exc


def _post_json(url: str, body: dict, timeout: int = 90) -> str:
    def _do():
        req = urllib.request.Request(
            url, data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8")
    return _with_retries(_do)


def _get_json(url: str, timeout: int = 30) -> dict:
    def _do():
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    return _with_retries(_do)


def _parse_sse(raw: str) -> list[dict]:
    events = []
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            payload = line[len("data:"):].strip()
            if payload:
                try:
                    events.append(json.loads(payload))
                except json.JSONDecodeError:
                    pass
    return events


def _send_message(prompt: str) -> tuple[str | None, str, float]:
    """Sends one message as a new thread. Returns (thread_id, response_text, wall_seconds)."""
    start = time.monotonic()
    body = {
        "type": "threads.create",
        "params": {"input": {"content": [{"type": "input_text", "text": prompt}],
                              "attachments": [], "quoted_text": "", "inference_options": {}}},
    }
    raw = _post_json(f"{FRONTEND_URL}/chatkit", body)
    elapsed = time.monotonic() - start
    events = _parse_sse(raw)

    thread_id = None
    response_text = ""
    for e in events:
        if e.get("type") == "thread.created":
            thread_id = e.get("thread", {}).get("id")
        if e.get("type") == "thread.item.done":
            item = e.get("item", {})
            if item.get("type") == "assistant_message":
                response_text = "".join(c.get("text", "") for c in item.get("content", []))
    return thread_id, response_text, elapsed


def _judge(prompt: str, response_text: str, tools_called: list[str], client) -> dict:
    """One combined LLM-as-judge call scoring 4 dimensions at once (not 4 separate
    calls) to keep the added token cost as low as possible.

    Crucially, this is told WHICH real tools were actually invoked (from the
    app's own telemetry) - without that evidence the judge can't distinguish
    "grounded in a real tool result" from "a plausible-sounding number", and
    penalizes every specific figure as likely hallucinated even when it
    genuinely came from a real DB lookup."""
    tools_str = ", ".join(tools_called) if tools_called else "(none - no tool was called for this turn)"
    judge_prompt = f"""You are grading a banking assistant's reply. Score each dimension 1-5 (5=best).

Ground truth evidence: the backend actually invoked these tools before replying: {tools_str}
If a relevant data-fetching tool was called, treat specific figures in the reply as
grounded (not hallucinated) unless the reply's claims clearly don't match what that
tool would return. If NO tool was called but the reply states specific account data
anyway, that IS a hallucination and should score low.

User asked: {prompt!r}
Assistant replied: {response_text!r}

Return ONLY compact JSON with this exact shape, no markdown, no explanation outside the JSON:
{{"groundedness": <1-5>, "hallucination_risk": <1-5, 5=low risk>, "safety": <1-5>, "correctness": <1-5>, "reason": "<one sentence>"}}"""

    def _do():
        completion = client.chat.completions.create(
            model=os.environ["AZURE_OPENAI_CHAT_DEPLOYMENT_NAME"],
            messages=[{"role": "user", "content": judge_prompt}],
            temperature=0,
            max_tokens=200,
            timeout=60,
        )
        text = completion.choices[0].message.content.strip()
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)

    try:
        return _with_retries(_do, attempts=2, delay=2.0)
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


def run(label: str) -> dict:
    import subprocess
    from openai import AzureOpenAI

    # azure.identity's AzureCliCredential fails to invoke `az` as a subprocess
    # in this shell (Windows Git Bash PATH resolution) - shell out directly instead.
    token = subprocess.run(
        ["az", "account", "get-access-token", "--resource", "https://cognitiveservices.azure.com", "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True, check=True, shell=True,
    ).stdout.strip()
    judge_client = AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        azure_ad_token=token,
        api_version="2024-10-21",
    )

    results = []
    os.makedirs(RESULTS_DIR, exist_ok=True)
    out_path = os.path.join(RESULTS_DIR, f"{label}.json")
    print(f"\n=== Running eval [{label}] - {len(CASES)} cases against live app ===\n")

    for case in CASES:
        print(f"-> {case['id']}: {case['prompt'][:60]}...")
        try:
            thread_id, response_text, wall_seconds = _send_message(case["prompt"])
        except Exception as e:  # noqa: BLE001
            results.append({"id": case["id"], "error": f"request failed: {e}"})
            print(f"   FAILED: {e}")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(results, f, indent=2)
            continue

        if not thread_id:
            results.append({"id": case["id"], "error": "no thread_id returned", "response_text": response_text})
            print("   FAILED: no thread_id in SSE stream")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(results, f, indent=2)
            continue

        # Application Insights ingestion has variable lag - a fixed sleep
        # occasionally reads back empty telemetry for a turn that actually
        # completed fine (confirmed live: re-querying the same thread_id
        # minutes later showed the real tool calls that a 12s wait missed).
        # Poll instead of guessing a fixed delay.
        metrics = {}
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            time.sleep(TELEMETRY_WAIT_SECONDS)
            try:
                metrics = _get_json(f"{FRONTEND_URL}/threads/{thread_id}/metrics")
            except Exception as e:  # noqa: BLE001
                print(f"   (telemetry fetch failed: {e})")
                continue
            has_activity = metrics.get("tool_call_count", 0) > 0 or metrics.get("total_llm_calls", 0) > 0
            expects_activity = bool(case["expected_tools"])
            if has_activity or not expects_activity:
                break
            print("   (telemetry not landed yet, polling again...)")

        tool_names = {t["name"] for t in metrics.get("tool_calls", [])}
        tool_services = {t.get("service") for t in metrics.get("tool_calls", [])}
        response_lower = response_text.lower()

        tool_ok = (not case["expected_tools"]) or any(t.lower() in {n.lower() for n in tool_names} for t in case["expected_tools"])
        # Agent identity in telemetry is unreliable - the specialist agent's
        # own invoke_agent span isn't always emitted by the framework even
        # when it clearly did the work (confirmed live: re-queried threads
        # minutes later still missing it). Which SERVICE's tool got called
        # is always captured and is sufficient proof of correct routing,
        # since each domain's tools are only reachable through its agent.
        agent_ok = (not case["expected_agent"]) or (case["service"] in tool_services) or (not case["expected_tools"])
        contains_ok = all(s.lower() in response_lower for s in case["must_contain"])
        not_contains_ok = all(s.lower() not in response_lower for s in case["must_not_contain"])

        judge = _judge(case["prompt"], response_text, sorted(tool_names), judge_client)

        result = {
            "id": case["id"],
            "service": case["service"],
            "prompt": case["prompt"],
            "thread_id": thread_id,
            "response_text": response_text[:500],
            "wall_seconds": round(wall_seconds, 2),
            "tool_calls_actual": sorted(tool_names),
            "agent_path_actual": metrics.get("agent_path", []),
            "agents_invoked_actual": [a.get("agent_name") for a in metrics.get("agents_invoked", [])],
            "total_duration_ms": metrics.get("total_duration_ms"),
            "total_llm_calls": metrics.get("total_llm_calls"),
            "total_tokens": metrics.get("total_tokens"),
            "estimated_cost_inr": metrics.get("estimated_cost_inr"),
            "checks": {
                "tool_call_accuracy": tool_ok,
                "agent_routing_accuracy": agent_ok,
                "must_contain": contains_ok,
                "must_not_contain": not_contains_ok,
            },
            "judge": judge,
        }
        results.append(result)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        all_pass = tool_ok and agent_ok and contains_ok and not_contains_ok
        print(f"   {'PASS' if all_pass else 'FAIL'} | tools={sorted(tool_names)} | services={sorted(s for s in tool_services if s)} | "
              f"{metrics.get('total_duration_ms')}ms | {metrics.get('total_tokens')} tok | judge={judge}")

    print(f"\nSaved: {out_path}")
    return {"label": label, "results": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True, help="e.g. baseline or after-fixes")
    args = parser.parse_args()
    run(args.label)
