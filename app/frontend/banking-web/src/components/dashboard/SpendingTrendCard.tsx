// "Is my spending going up or down?" - one series, so no legend box is needed;
// the title names it. A floating badge pins the latest value directly on the
// chart, and the summary line below compares the whole selected window
// against the equal-length window before it.
//
// The 6 Months / 1 Year toggle previously only re-sliced the chart while the
// "% vs last month" line stayed pinned to the same two months regardless of
// range - so clicking it looked like nothing happened. It now recomputes
// against the selected range, exactly like CashFlowCard.
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SERIES, formatINR, formatCompactINR } from "@/lib/chartTokens";

type Range = "6M" | "1Y";
const RANGE_MONTHS: Record<Range, number> = { "6M": 6, "1Y": 12 };

interface MonthExpense {
  month: string;
  expenses: number;
}

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Spent <span className="font-semibold text-foreground">{formatINR(payload[0].value)}</span>
      </p>
    </div>
  );
}

/** Floating "Aug ₹58,340" chip pinned above the latest point, like a permanently-open tooltip.
 * The latest point is always the rightmost one on the chart, so the badge is
 * anchored to END at the dot (extending leftward) rather than centered on it -
 * centering pushed it past the chart's right edge and clipped the text. */
function LatestValueBadge({ viewBox, month, value }: {
  viewBox?: { x?: number; y?: number };
  month: string;
  value: number;
}) {
  if (viewBox?.x == null || viewBox?.y == null) return null;
  const text = `${month} ${formatCompactINR(value)}`;
  const width = Math.max(64, text.length * 6.5 + 16);
  const x = Math.max(0, viewBox.x - width);
  const y = viewBox.y - 34;
  return (
    <g>
      <rect x={x} y={y} width={width} height={22} rx={6} fill={SERIES.expense} />
      <text x={x + width / 2} y={y + 15} textAnchor="middle" fontSize={11} fontWeight={600} fill="white">
        {text}
      </text>
    </g>
  );
}

export function SpendingTrendCard({ data }: { data: MonthExpense[] }) {
  const [range, setRange] = useState<Range>("6M");
  const months = RANGE_MONTHS[range];

  const sliced = useMemo(() => data.slice(-months), [data, months]);
  const priorSlice = useMemo(() => data.slice(-months * 2, -months), [data, months]);

  const total = sliced.reduce((s, d) => s + d.expenses, 0);
  const priorTotal = priorSlice.reduce((s, d) => s + d.expenses, 0);
  const changePct = priorSlice.length > 0 && priorTotal !== 0 ? ((total - priorTotal) / priorTotal) * 100 : null;
  const flat = changePct != null && Math.abs(changePct) < 0.05;
  const improved = changePct != null && changePct < 0;
  const periodLabel = range === "6M" ? "the previous 6 months" : "the previous year";

  const latestPoint = sliced[sliced.length - 1];

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Spending Trend</h3>
            <p className="text-sm text-muted-foreground">Monthly expenses over time</p>
          </div>
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Spending trend time range">
            {(["6M", "1Y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "6M" ? "6 Months" : "1 Year"}
              </button>
            ))}
          </div>
        </div>

        {/* min-h is load-bearing: flex-1 sets basis:0, which collapses a purely
            height-based chart box to zero when no sibling stretches the card. */}
        <div className="mt-4 h-[240px] min-h-[240px] w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.expense} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={SERIES.expense} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              {/* minTickGap lets recharts drop labels instead of letting them
                  collide on narrow viewports. */}
              <XAxis dataKey="month" axisLine={false} tickLine={false} minTickGap={20}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis axisLine={false} tickLine={false} width={52} tickFormatter={formatCompactINR}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="expenses" stroke={SERIES.expense} strokeWidth={2}
                fill="url(#spendFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
              {latestPoint && (
                <ReferenceDot
                  x={latestPoint.month} y={latestPoint.expenses} r={5}
                  fill={SERIES.expense} stroke="hsl(var(--card))" strokeWidth={2} isFront
                  label={(props: { viewBox?: { x?: number; y?: number } }) => (
                    <LatestValueBadge viewBox={props.viewBox} month={latestPoint.month} value={latestPoint.expenses} />
                  )}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {changePct != null && (
          <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${flat ? "text-muted-foreground" : improved ? "text-green-600" : "text-rose-600"}`}>
            {flat ? null : improved ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> : <TrendingUp className="h-4 w-4" aria-hidden="true" />}
            {flat ? "Unchanged" : `${Math.abs(changePct).toFixed(1)}% ${improved ? "less" : "more"}`} vs {periodLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
