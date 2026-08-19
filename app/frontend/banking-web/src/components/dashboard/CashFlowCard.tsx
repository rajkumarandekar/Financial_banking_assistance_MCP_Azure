// "Am I earning more than I'm spending?" - the one question this section
// exists to answer.
//
// Income and expenses share a single y-axis (both are rupees, so a second
// scale would be a lie). The chart and its summary tiles sit side by side so
// the card never leaves a large blank region the way a full-width chart with a
// short series does.
//
// The 6 Months / 1 Year toggle drives BOTH halves: the chart re-slices, and
// the Income/Expenses/Net tiles switch from "this month" to a sum over the
// whole selected range, compared against the equal-length period before it.
// A toggle that only changed the chart line looked broken, since a chart
// re-slice is easy to miss - the summary panel changing numbers is not.
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp, Minus, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SERIES, formatINR, formatCompactINR } from "@/lib/chartTokens";
import { sumCashFlow, type MonthFlow } from "@/lib/cashFlow";

type Range = "6M" | "1Y";
const RANGE_MONTHS: Record<Range, number> = { "6M": 6, "1Y": 12 };

function CashFlowTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const expenses = payload.find((p) => p.dataKey === "expenses")?.value ?? 0;
  const net = income - expenses;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-sm font-semibold text-foreground">{label}</p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES.income }} />
        Income<span className="ml-auto font-semibold text-foreground">{formatINR(income)}</span>
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES.expense }} />
        Expenses<span className="ml-auto font-semibold text-foreground">{formatINR(expenses)}</span>
      </p>
      <p className="mt-1 border-t border-border/60 pt-1 text-xs text-muted-foreground">
        Net<span className={`ml-auto font-semibold ${net >= 0 ? "text-green-600" : "text-rose-600"}`}>
          {" "}{net >= 0 ? "+" : "−"}{formatINR(Math.abs(net))}
        </span>
      </p>
    </div>
  );
}

function SummaryTile({ label, value, delta, deltaLabel, tone }: {
  label: string;
  value: number;
  delta: number | null;
  deltaLabel: string;
  tone: "income" | "expense" | "net";
}) {
  const color = tone === "income" ? "text-green-600" : tone === "expense" ? "text-rose-600" : value >= 0 ? "text-green-600" : "text-rose-600";

  // A delta that rounds to 0.0% is "unchanged" - showing it as a red decline
  // (or a green rise) would be reading meaning into noise.
  const flat = delta != null && Math.abs(delta) < 0.05;
  // For expenses a rise is unfavourable; for income and net a rise is good.
  const favourable = delta == null || flat ? null : tone === "expense" ? delta < 0 : delta > 0;
  const Icon = flat ? Minus : delta != null && delta > 0 ? TrendingUp : TrendingDown;
  const deltaClass = flat ? "text-muted-foreground" : favourable ? "text-green-600" : "text-rose-600";

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${color}`}>
        {tone === "net" && value >= 0 ? "+" : tone === "net" ? "−" : ""}{formatINR(Math.abs(value))}
      </p>
      {delta != null && (
        <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-medium ${deltaClass}`}>
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {flat ? `Unchanged ${deltaLabel}` : `${Math.abs(delta).toFixed(1)}% ${deltaLabel}`}
        </p>
      )}
    </div>
  );
}

export function CashFlowCard({ data }: { data: MonthFlow[] }) {
  const [range, setRange] = useState<Range>("6M");
  const months = RANGE_MONTHS[range];

  // The chart's window, and the equal-length window immediately before it -
  // e.g. for 6M, the trailing 6 months and the 6 months before that.
  const sliced = useMemo(() => data.slice(-months), [data, months]);
  const priorSlice = useMemo(() => data.slice(-months * 2, -months), [data, months]);

  const { income, expenses, net } = sumCashFlow(sliced);
  const priorTotals = priorSlice.length > 0 ? sumCashFlow(priorSlice) : null;

  const pctChange = (curr: number, prev: number | undefined) =>
    prev != null && prev !== 0 ? ((curr - prev) / prev) * 100 : null;

  const incomeDelta = pctChange(income, priorTotals?.income);
  const expenseDelta = pctChange(expenses, priorTotals?.expenses);
  const netDelta =
    priorTotals != null && priorTotals.net !== 0 ? ((net - priorTotals.net) / Math.abs(priorTotals.net)) * 100 : null;

  const rangeLabel = range === "6M" ? "the last 6 months" : "the last year";
  const priorRangeLabel = range === "6M" ? "the previous 6 months" : "the previous year";
  const deltaLabel = `vs ${priorRangeLabel}`;

  const insight = (() => {
    if (net > 0) return `You saved ${formatINR(net)} over ${rangeLabel}.`;
    if (expenses > 0 && income === 0) return `No income recorded over ${rangeLabel}, against ${formatINR(expenses)} of spending.`;
    if (net === 0 && expenses === 0) return `No transactions recorded over ${rangeLabel}.`;
    return `You spent ${formatINR(Math.abs(net))} more than you received over ${rangeLabel}.`;
  })();

  return (
    <Card className="w-full border-border/70">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cash Flow</h3>
            <p className="text-xs text-muted-foreground">Income vs expenses</p>
          </div>
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Cash flow time range">
            {(["6M", "1Y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "6M" ? "6 Months" : "1 Year"}
              </button>
            ))}
          </div>
        </div>

        {/* items-start is load-bearing: grid items stretch to equal height by
            default, which was pulling the chart column down to match the
            tiles column and leaving dead space below the chart. The right
            column is a 2x2 tile grid (not a 4-tall stack), so it naturally
            lands close to the chart's own height instead of towering over it. */}
        <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {/* Legend - identity is never colour-alone */}
            <div className="mb-1.5 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES.income }} />Income
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES.expense }} />Expenses
              </span>
            </div>

            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sliced} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cfIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES.income} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={SERIES.income} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cfExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES.expense} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={SERIES.expense} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  {/* minTickGap lets recharts drop labels instead of letting
                      them collide on narrow viewports. */}
                  <XAxis dataKey="month" axisLine={false} tickLine={false} minTickGap={20}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis axisLine={false} tickLine={false} width={52} tickFormatter={formatCompactINR}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CashFlowTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="income" stroke={SERIES.income} strokeWidth={2}
                    fill="url(#cfIncome)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                  <Area type="monotone" dataKey="expenses" stroke={SERIES.expense} strokeWidth={2}
                    fill="url(#cfExpense)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2x2: Income | Expenses on top, Net Cash Flow | Insight below */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryTile label={`Income · ${range === "6M" ? "6mo" : "1yr"}`} value={income} delta={incomeDelta} deltaLabel={deltaLabel} tone="income" />
            <SummaryTile label={`Expenses · ${range === "6M" ? "6mo" : "1yr"}`} value={expenses} delta={expenseDelta} deltaLabel={deltaLabel} tone="expense" />
            <SummaryTile label={`Net Cash Flow · ${range === "6M" ? "6mo" : "1yr"}`} value={net} delta={netDelta} deltaLabel={deltaLabel} tone="net" />
            <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />Insight
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-foreground">{insight}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
