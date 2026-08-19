// The last handful of score-affecting events, newest first.
//
// The service records an impact of positive/neutral/negative but no point
// value, so the "+12 pts" figure shown here is an estimate from
// lib/creditScore#estimatedPoints (deterministic from event type + impact,
// never random) - not a number the ledger actually reports. Impact is still
// conveyed by icon + label + colour, never colour alone, so the estimate
// disclosure doesn't become the only signal.
import { CheckCircle2, AlertTriangle, CircleDot, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeImpact, humanizeEventType, estimatedPoints, type ImpactKind } from "@/lib/creditScore";
import type { CreditHistoryEvent } from "@/models/Domain";

const IMPACT_STYLE: Record<ImpactKind, { icon: typeof CheckCircle2; label: string; className: string; ring: string }> = {
  positive: { icon: CheckCircle2, label: "Positive impact", className: "text-green-600", ring: "bg-green-50 text-green-700" },
  negative: { icon: AlertTriangle, label: "Negative impact", className: "text-rose-600", ring: "bg-rose-50 text-rose-700" },
  neutral: { icon: CircleDot, label: "Neutral impact", className: "text-muted-foreground", ring: "bg-muted text-muted-foreground" },
};

interface RecentChangesCardProps {
  history: CreditHistoryEvent[];
  onViewAll: () => void;
}

export function RecentChangesCard({ history, onViewAll }: RecentChangesCardProps) {
  const recent = [...history]
    .sort((a, b) => new Date(b.eventDate ?? 0).getTime() - new Date(a.eventDate ?? 0).getTime())
    .slice(0, 5);

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <h2 className="text-base font-semibold text-foreground">Recent Changes</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">What's affected your score lately · points are estimated</p>

        {recent.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
            No credit events recorded yet.
          </p>
        ) : (
          <ul className="mt-4 flex-1 divide-y divide-border/60">
            {recent.map((e, i) => {
              const impact = normalizeImpact(e.impact);
              const style = IMPACT_STYLE[impact];
              const Icon = style.icon;
              const pts = estimatedPoints(e);
              return (
                <li key={e.id ?? `${e.eventType}-${e.eventDate}-${i}`} className="flex items-start gap-3 py-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.ring}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{humanizeEventType(e.eventType)}</p>
                    <p className={`text-xs ${style.className}`}>{style.label}</p>
                    {e.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.description}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {e.eventDate
                        ? new Date(e.eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : "--"}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${style.className}`}>
                      {pts === 0 ? "0 pts" : `${pts > 0 ? "+" : ""}${pts} pts`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button
          onClick={onViewAll}
          className="mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View full history <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </CardContent>
    </Card>
  );
}
