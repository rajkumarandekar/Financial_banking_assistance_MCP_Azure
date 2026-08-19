// KPI row + the compact "cash flow insight" banner beneath it. Every figure
// and every delta comes from Totals computed against the real transaction
// ledger - nothing here is a hardcoded example number.
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Lightbulb, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/chartTokens";
import type { Totals } from "@/lib/transactionAnalytics";

/** favourableWhenUp: null means this metric has no inherent "good direction"
 * (e.g. average transaction size) - shown with a neutral tone, arrow for
 * direction only, never colored as if smaller/bigger were better. */
function DeltaLine({ pct, favourableWhenUp }: { pct: number | null; favourableWhenUp: boolean | null }) {
  if (pct == null) return <p className="mt-1 text-xs text-muted-foreground">vs previous period — no prior data</p>;
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  const favourable = flat || favourableWhenUp == null ? null : favourableWhenUp ? up : !up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = favourable == null ? "text-muted-foreground" : favourable ? "text-green-600" : "text-rose-600";
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {flat ? "Unchanged" : `${Math.abs(pct).toFixed(1)}%`} vs previous period
    </p>
  );
}

function KpiCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50 hover:bg-card/70 transition-all duration-200">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-2">{children}</div>
      </CardContent>
    </Card>
  );
}

interface AnalyticsKpisProps {
  totals: Totals;
  incomeDelta: number | null;
  expenseDelta: number | null;
  netDelta: number | null;
  avgDelta: number | null;
}

export function AnalyticsKpis({ totals, incomeDelta, expenseDelta, netDelta, avgDelta }: AnalyticsKpisProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total Income">
        <p className="text-2xl font-bold tabular-nums text-foreground">{formatINR(totals.income)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Across {totals.incomeCount} transaction{totals.incomeCount === 1 ? "" : "s"}</p>
        <DeltaLine pct={incomeDelta} favourableWhenUp />
      </KpiCard>

      <KpiCard label="Total Expenses">
        <p className="text-2xl font-bold tabular-nums text-foreground">{formatINR(totals.expenses)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Across {totals.expenseCount} transaction{totals.expenseCount === 1 ? "" : "s"}</p>
        <DeltaLine pct={expenseDelta} favourableWhenUp={false} />
      </KpiCard>

      <KpiCard label="Net Cash Flow">
        <p className={`text-2xl font-bold tabular-nums ${totals.net >= 0 ? "text-foreground" : "text-rose-600"}`}>
          {totals.net >= 0 ? "" : "-"}{formatINR(Math.abs(totals.net))}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{totals.net >= 0 ? "Income − expenses" : "Cash flow deficit"}</p>
        <DeltaLine pct={netDelta} favourableWhenUp />
      </KpiCard>

      <KpiCard label="Avg. Transaction">
        <p className="text-2xl font-bold tabular-nums text-foreground">{formatINR(totals.avg)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Across {totals.count} transaction{totals.count === 1 ? "" : "s"}</p>
        <DeltaLine pct={avgDelta} favourableWhenUp={null} />
      </KpiCard>
    </div>
  );
}

export function CashFlowInsightBanner({ totals, onViewDetails }: { totals: Totals; onViewDetails: () => void }) {
  const positive = totals.net >= 0;
  const pctOfIncome = totals.income > 0 ? (Math.abs(totals.net) / totals.income) * 100 : 0;

  return (
    <Card className={`border ${positive ? "border-primary/25 bg-primary/[0.04]" : "border-rose-300/50 bg-rose-50/60"}`}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive ? "bg-primary/10 text-primary" : "bg-rose-100 text-rose-600"}`}>
            {positive ? <Lightbulb className="h-4.5 w-4.5" aria-hidden="true" /> : <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{positive ? "Cash flow insight" : "Cash flow alert"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {totals.count === 0
                ? "No transactions recorded in this period."
                : positive
                ? `You saved ${formatINR(totals.net)} this period. Your income exceeded expenses by ${pctOfIncome.toFixed(1)}%.`
                : `Expenses exceeded income by ${formatINR(Math.abs(totals.net))} this period.`}
            </p>
          </div>
        </div>
        <button
          onClick={onViewDetails}
          className="shrink-0 self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:self-center"
        >
          View Details
        </button>
      </CardContent>
    </Card>
  );
}
