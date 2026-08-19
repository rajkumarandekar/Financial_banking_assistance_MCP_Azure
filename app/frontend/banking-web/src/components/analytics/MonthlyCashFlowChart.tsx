import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { SERIES, formatINR, formatCompactINR } from "@/lib/chartTokens";
import { computeMonthlyCashFlow, type MonthFlow } from "@/lib/cashFlow";

type Range = "6M" | "1Y";
const RANGE_MONTHS: Record<Range, number> = { "6M": 6, "1Y": 12 };

interface TxLike {
  timestamp: string;
  amount: number;
  flowType?: string;
}

function CashFlowTooltip({ active, payload }: {
  active?: boolean;
  payload?: { value: number; dataKey: string; payload: MonthFlow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const net = row.income - row.expenses;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-sm font-semibold text-foreground">{row.fullLabel}</p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES.income }} />
        Income<span className="ml-auto font-semibold text-foreground">{formatINR(row.income)}</span>
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES.expense }} />
        Expenses<span className="ml-auto font-semibold text-foreground">{formatINR(row.expenses)}</span>
      </p>
      <p className="mt-1 border-t border-border/60 pt-1 text-xs text-muted-foreground">
        Net<span className={`ml-auto font-semibold ${net >= 0 ? "text-green-600" : "text-rose-600"}`}>
          {" "}{net >= 0 ? "+" : "−"}{formatINR(Math.abs(net))}
        </span>
      </p>
    </div>
  );
}

export function MonthlyCashFlowChart({ transactions }: { transactions: TxLike[] }) {
  const [range, setRange] = useState<Range>("6M");
  const months = useMemo(() => computeMonthlyCashFlow(transactions, 12), [transactions]);
  const sliced = months.slice(-RANGE_MONTHS[range]);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">Monthly Cash Flow</h3>
            <p className="text-xs text-muted-foreground">Income vs expenses by month</p>
          </div>
          <div className="flex rounded-lg border border-border/60 p-0.5">
            {(["6M", "1Y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "6M" ? "6 Months" : "1 Year"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sliced} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} minTickGap={12}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis axisLine={false} tickLine={false} width={52} tickFormatter={formatCompactINR}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<CashFlowTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Bar dataKey="income" fill={SERIES.income} radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" fill={SERIES.expense} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES.income }} />Income
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES.expense }} />Expenses
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
