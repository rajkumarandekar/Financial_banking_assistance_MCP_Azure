import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bot, CheckCircle2, Clock, MessageSquare, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface ToolCallMetric {
  name: string;
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
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
}

const TIMELINE_ICON: Record<string, typeof MessageSquare> = {
  user_message: MessageSquare,
  assistant_message: Bot,
  task: Clock,
  tool_call: Wrench,
  approval_request: CheckCircle2,
};

const TIMELINE_LABEL: Record<string, string> = {
  user_message: "User message",
  assistant_message: "Assistant reply",
  task: "Agent step",
  tool_call: "Tool call",
  approval_request: "Approval requested",
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
    fetch(`/threads/${threadId}/metrics`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data: ThreadMetrics) => setMetrics(data))
      .catch((e) => setError(e.message || "Failed to load metrics"))
      .finally(() => setLoading(false));
  }, [threadId]);

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
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
              <p className="text-xs text-muted-foreground">Tool calls</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.tool_call_count}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className={`mt-1 text-2xl font-semibold ${metrics.error_count > 0 ? "text-destructive" : "text-foreground"}`}>
                {metrics.error_count}
              </p>
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

          {metrics.tool_calls.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Tool calls</h2>
              <div className="space-y-3">
                {metrics.tool_calls.map((tc, i) => (
                  <div key={i} className="rounded-lg border border-border/70 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tc.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-sm font-medium text-foreground">{tc.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDuration(tc.step_latency_ms)}</span>
                    </div>
                    {Object.keys(tc.arguments).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-6 text-xs text-muted-foreground">
                        {Object.entries(tc.arguments).map(([k, v]) => (
                          <span key={k}>
                            <span className="font-medium text-foreground">{k}:</span> {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
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
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.at).toLocaleTimeString()} · +{formatDuration(entry.step_latency_ms)}
                        </p>
                      </div>
                    </div>
                    {i < metrics.timeline.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
