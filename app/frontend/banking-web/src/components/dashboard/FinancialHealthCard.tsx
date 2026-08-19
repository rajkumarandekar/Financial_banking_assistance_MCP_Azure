// Composite health score plus the four sub-metrics that produced it, so the
// number is explainable rather than mysterious. Each metric shows a bar (how
// strong) and a status word (what that means) - never colour alone.
//
// The ring is a plain SVG arc rather than a chart-library radial: it's a single
// static value, so pulling in a chart instance for it would be overkill.
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/useCountUp";
import { STATUS } from "@/lib/chartTokens";
import type { FinancialHealth, HealthLevel } from "@/lib/financialHealth";

const LEVEL_COLOR: Record<HealthLevel, string> = {
  Excellent: STATUS.excellent,
  Good: STATUS.good,
  Fair: STATUS.warning,
  "Needs attention": STATUS.critical,
};

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function FinancialHealthCard({ health }: { health: FinancialHealth }) {
  const navigate = useNavigate();
  const animated = useCountUp(health.overall);
  const color = health.overall >= 70 ? STATUS.excellent : health.overall >= 45 ? STATUS.warning : STATUS.critical;

  const weakest = [...health.metrics].sort((a, b) => a.score - b.score)[0];
  const strongest = [...health.metrics].sort((a, b) => b.score - a.score)[0];
  const summary =
    health.status === "Healthy"
      ? `${strongest.label} is doing the most for your score right now.`
      : `Improving ${weakest.label.toLowerCase()} would move your score the most.`;

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <h3 className="text-base font-semibold text-foreground">Financial Health</h3>

        <div className="mt-4 flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" role="img"
              aria-label={`Financial health ${health.overall} out of 100, rated ${health.status}`}>
              <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth={11} />
              <circle
                cx="64" cy="64" r={RADIUS} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE - (animated / 100) * CIRCUMFERENCE}
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold tabular-nums" style={{ color }}>{Math.round(animated)}</p>
              <p className="text-[11px] text-muted-foreground">/ 100</p>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-lg font-semibold" style={{ color }}>{health.status}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
          </div>
        </div>

        <div className="mt-6 flex-1 space-y-3.5">
          {health.metrics.map((m) => (
            <div key={m.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">{m.label}</span>
                <span className="shrink-0 text-xs font-medium" style={{ color: LEVEL_COLOR[m.level] }}>{m.level}</span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar" aria-valuenow={m.score} aria-valuemin={0} aria-valuemax={100}
                aria-label={`${m.label}: ${m.level}`}
              >
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${m.score}%`, backgroundColor: LEVEL_COLOR[m.level] }} />
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="mt-5 w-full justify-between" onClick={() => navigate("/credit-score")}>
          View full report
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
