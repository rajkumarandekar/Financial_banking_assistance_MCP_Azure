// "How has this month's paid/pending activity moved day by day?" - real data
// from payment-service, bucketed per calendar day up to today (see
// lib/payments#computeMonthlyTrend). Two series sharing one rupee axis, never
// a dual-axis chart.
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS, formatINR, formatCompactINR } from "@/lib/chartTokens";
import type { DailyPaymentPoint } from "@/lib/payments";

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const paid = payload.find((p) => p.dataKey === "paid")?.value ?? 0;
  const pending = payload.find((p) => p.dataKey === "pending")?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS.excellent }} />
        Paid<span className="ml-auto font-semibold text-foreground">{formatINR(paid)}</span>
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS.warning }} />
        Pending<span className="ml-auto font-semibold text-foreground">{formatINR(pending)}</span>
      </p>
    </div>
  );
}

interface PaymentTrendChartProps {
  data: DailyPaymentPoint[];
  monthLabel: string;
}

export function PaymentTrendChart({ data, monthLabel }: PaymentTrendChartProps) {
  const hasActivity = data.some((d) => d.paid > 0 || d.pending > 0);
  // Summed straight from what's plotted, not passed in separately - so this
  // footer can never drift out of sync with the chart above it.
  const totalPaid = data.reduce((s, d) => s + d.paid, 0);
  const totalPending = data.reduce((s, d) => s + d.pending, 0);

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Monthly Payment Trend</h3>
          <span className="text-xs text-muted-foreground">{monthLabel}</span>
        </div>

        <div className="mb-1.5 mt-2 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS.excellent }} />Paid
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS.warning }} />Pending
          </span>
        </div>

        {/* min-h is load-bearing: flex-1 sets basis:0, which collapses a
            purely height-based chart box to zero when no sibling stretches
            the card. */}
        <div className="h-[220px] min-h-[220px] w-full flex-1">
          {hasActivity ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ptPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STATUS.excellent} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={STATUS.excellent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ptPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STATUS.warning} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={STATUS.warning} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} minTickGap={24}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis axisLine={false} tickLine={false} width={48} tickFormatter={formatCompactINR}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="paid" stroke={STATUS.excellent} strokeWidth={2}
                  fill="url(#ptPaid)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                <Area type="monotone" dataKey="pending" stroke={STATUS.warning} strokeWidth={2}
                  fill="url(#ptPending)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
              <p className="text-sm font-medium text-foreground">No payment activity this month</p>
              <p className="mt-1 text-xs text-muted-foreground">Payments you make will appear here.</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
          <span className="text-muted-foreground">Total paid <span className="font-semibold text-foreground">{formatINR(totalPaid)}</span></span>
          <span className="text-muted-foreground">Total pending <span className="font-semibold text-foreground">{formatINR(totalPending)}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
