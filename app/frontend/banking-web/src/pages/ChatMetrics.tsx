import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Bot, Brain, CheckCircle2, Clock, Coins, Loader2, MessageSquare, Server, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface LlmCallMetric {
  at: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  finish_reason: string | null;
  estimated_cost_inr: number;
}

interface ToolExecutionMetric {
  at: string;
  tool_name: string;
  service: string;
  duration_ms: number;
}

interface ToolCallMetric {
  name: string;
  service?: string;
  status: string;
  arguments: Record<string, unknown>;
  at: string;
  step_latency_ms: number;
}

interface TimelineEntry {
  type: string;
  at: string;
  step_latency_ms: number;
  title?: string;
  name?: string;
  status?: string;
  tool_name?: string;
  model?: string;
  service?: string;
}

interface ThreadMetrics {
  thread_id: string;
  title: string | null;
  created_at: string;
  turn_count: number;
  assistant_turn_count: number;
  total_duration_ms: number;
  tool_call_count: number;
  error_count: number;
  agent_path: string[];
  tool_calls: ToolCallMetric[];
  timeline: TimelineEntry[];
  llm_calls: LlmCallMetric[];
  tool_executions: ToolExecutionMetric[];
  total_llm_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  estimated_cost_inr: number;
  models_used: string[];
  service_breakdown: Record<string, number>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
}

function formatINR(amount: number): string {
  if (amount === 0) return "₹0";
  if (amount < 1) return `₹${amount.toFixed(4)}`;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const TIMELINE_ICON: Record<string, typeof MessageSquare> = {
  user_message: MessageSquare,
  assistant_message: Bot,
  task: Clock,
  tool_call: Wrench,
  approval_request: CheckCircle2,
  llm_call: Brain,
  tool_execution: Server,
};

const TIMELINE_LABEL: Record<string, string> = {
  user_message: "User message",
  assistant_message: "Assistant reply",
  task: "Agent step",
  tool_call: "Tool call",
  approval_request: "Approval requested",
  llm_call: "LLM call",
  tool_execution: "MCP tool call",
};

export default function ChatMetrics() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ThreadMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!threadId) return;
    setLoading(true);
    setError(null);
    // The telemetry half of this query runs against Log Analytics, which can
    // occasionally be slow - bound it so the loader can never spin forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    fetch(`/threads/${threadId}/metrics`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data: ThreadMetrics) => setMetrics(data))
      .catch((e) => setError(e.name === "AbortError" ? "Timed out - please try again" : (e.message || "Failed to load metrics")))
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [threadId]);

  const chartData = metrics?.llm_calls.map((call, i) => ({
    label: `#${i + 1}`,
    time: new Date(call.at).toLocaleTimeString(),
    durationSec: Math.round((call.duration_ms / 1000) * 10) / 10,
    tokens: call.input_tokens + call.output_tokens,
  })) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-primary/10">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Chat Metrics</p>
          <h1 className="text-lg font-semibold text-foreground">{metrics?.title || "Conversation"}</h1>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Crunching tokens, latency, and cost for this conversation...
          </p>
        </div>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Couldn't load metrics for this chat: {error}
        </Card>
      )}

      {metrics && !loading && !error && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total duration</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatDuration(metrics.total_duration_ms)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">User messages</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.turn_count}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">LLM calls</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.total_llm_calls}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">MCP tool calls</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.tool_executions.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Input tokens</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.total_input_tokens.toLocaleString("en-IN")}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Output tokens</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.total_output_tokens.toLocaleString("en-IN")}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total tokens</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.total_tokens.toLocaleString("en-IN")}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Estimated cost</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatINR(metrics.estimated_cost_inr)}</p>
            </Card>
          </div>

          {metrics.agent_path.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Agent path</h2>
              <div className="flex flex-wrap items-center gap-2">
                {metrics.agent_path.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">{step}</Badge>
                    {i < metrics.agent_path.length - 1 && <span className="text-muted-foreground">→</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {chartData.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-1 text-sm font-semibold text-foreground">Response time per LLM call</h2>
              <p className="mb-3 text-xs text-muted-foreground">Model: {metrics.models_used.join(", ")}</p>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cmDuration" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v}s`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) => name === "durationSec" ? [`${value}s`, "Duration"] : [value, "Tokens"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.time ?? label}
                    />
                    <Area type="monotone" dataKey="durationSec" stroke="#2563eb" strokeWidth={2}
                      fill="url(#cmDuration)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {Object.keys(metrics.service_breakdown).length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">MCP servers called</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(metrics.service_breakdown).map(([service, count]) => (
                  <Badge key={service} variant="outline" className="font-normal capitalize">
                    {service} · {count} call{count === 1 ? "" : "s"}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {metrics.llm_calls.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">LLM calls</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Time</th>
                      <th className="pb-2 pr-4 font-medium">Model</th>
                      <th className="pb-2 pr-4 font-medium">Input</th>
                      <th className="pb-2 pr-4 font-medium">Output</th>
                      <th className="pb-2 pr-4 font-medium">Duration</th>
                      <th className="pb-2 pr-4 font-medium">Finish</th>
                      <th className="pb-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.llm_calls.map((call, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground">{new Date(call.at).toLocaleTimeString()}</td>
                        <td className="py-2 pr-4 text-foreground">{call.model}</td>
                        <td className="py-2 pr-4 text-foreground">{call.input_tokens.toLocaleString("en-IN")}</td>
                        <td className="py-2 pr-4 text-foreground">{call.output_tokens.toLocaleString("en-IN")}</td>
                        <td className="py-2 pr-4 text-foreground">{formatDuration(call.duration_ms)}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{call.finish_reason ?? "—"}</td>
                        <td className="py-2 text-foreground">{formatINR(call.estimated_cost_inr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Cost is estimated from published per-token list pricing, not an actual invoice line.
              </p>
            </Card>
          )}

          {metrics.tool_executions.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">MCP tool executions</h2>
              <div className="space-y-2">
                {metrics.tool_executions.map((exe, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{exe.tool_name}</span>
                      <Badge variant="outline" className="text-[10px] font-normal capitalize">{exe.service}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDuration(exe.duration_ms)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Timeline</h2>
            <div className="space-y-0">
              {metrics.timeline.map((entry, i) => {
                const Icon = TIMELINE_ICON[entry.type] ?? Clock;
                return (
                  <div key={i}>
                    <div className="flex items-start gap-3 py-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          {TIMELINE_LABEL[entry.type] ?? entry.type}
                          {entry.title ? ` — ${entry.title}` : ""}
                          {entry.name ? ` — ${entry.name}` : ""}
                          {entry.tool_name ? ` — ${entry.tool_name}` : ""}
                          {entry.model ? ` — ${entry.model}` : ""}
                          {entry.service ? ` (${entry.service})` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.at).toLocaleTimeString()} · {formatDuration(entry.step_latency_ms)}
                        </p>
                      </div>
                    </div>
                    {i < metrics.timeline.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            LLM/tool telemetry reflects the last 30 days (Log Analytics retention window).
          </p>
        </div>
      )}
    </div>
  );
}
