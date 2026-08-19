// "Is my score improving?"
//
// credit-service stores only today's score, not a month-by-month history, so
// this line is an ESTIMATE: it walks backward from the one real number we
// have (today's score) using each credit event's estimated point impact (see
// lib/creditScore's "Point estimates" section). The info tooltip discloses
// that plainly rather than presenting it as ledger fact.
import { Info, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SERIES } from "@/lib/chartTokens";
import { MIN_SCORE, MAX_SCORE, type ScoreTrendPoint } from "@/lib/creditScore";

interface ScoreTrendCardProps {
  trend: ScoreTrendPoint[];
  insight: string | null;
}

function ScoreTooltip({ active, payload, label, trend }: {
  active?: boolean;
  payload?: { value: number; payload: ScoreTrendPoint }[];
  label?: string;
  trend: ScoreTrendPoint[];
}) {
  if (!active || !payload?.length) return null;
  const idx = trend.findIndex((p) => p.date === label);
  const prev = idx > 0 ? trend[idx - 1].score : null;
  const value = payload[0].value;
  const delta = prev != null ? value - prev : null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Credit score <span className="font-semibold text-foreground">{value}</span>
      </p>
      {delta != null && delta !== 0 && (
        <p className={`text-xs font-medium ${delta > 0 ? "text-green-600" : "text-rose-600"}`}>
          {delta > 0 ? "+" : ""}{delta} vs previous month
        </p>
      )}
    </div>
  );
}

export function ScoreTrendCard({ trend, insight }: ScoreTrendCardProps) {
  const hasTrend = trend.length >= 2;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const overallDelta = hasTrend ? last.score - first.score : null;

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-foreground">Score Trend</h2>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="About this trend line"
                    className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px]">
                  Your bank stores only today's score, not a month-by-month history. This line is estimated by walking backward from your real current score using the impact of your recorded credit events.
                </TooltipContent>
              </UiTooltip>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">Estimated, based on your credit activity</p>
          </div>
        </div>

        {/* min-h is load-bearing: flex-1 sets basis:0, which collapses a purely
            height-based chart box to zero when no sibling stretches the card. */}
        <div className="mt-4 h-[240px] min-h-[240px] w-full flex-1">
          {hasTrend ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES.income} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SERIES.income} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={20}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[MIN_SCORE, MAX_SCORE]} axisLine={false} tickLine={false} width={44}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ScoreTooltip trend={trend} />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="score" stroke={SERIES.income} strokeWidth={2}
                  fill="url(#scoreFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
              <p className="text-sm font-medium text-foreground">No score trend available yet</p>
              <p className="mt-1 max-w-[320px] text-xs text-muted-foreground">We need a current score on file to estimate a trend.</p>
            </div>
          )}
        </div>

        {overallDelta != null && (
          <p className={`mt-3 text-sm font-medium ${overallDelta >= 0 ? "text-green-600" : "text-rose-600"}`}>
            {overallDelta >= 0 ? "↑" : "↓"} {Math.abs(overallDelta)} points since {first.date}
          </p>
        )}

        {insight && (
          <p className="mt-2 flex items-start gap-1.5 border-t border-border/60 pt-3 text-sm text-muted-foreground">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
