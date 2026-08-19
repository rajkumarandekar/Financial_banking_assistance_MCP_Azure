import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { SERIES, formatINR, formatCompactINR } from "@/lib/chartTokens";
import type { TrendPoint } from "@/lib/transactionAnalytics";

type Mode = "income" | "expenses" | "both";
const MODES: { key: Mode; label: string }[] = [
  { key: "income", label: "Income" },
  { key: "expenses", label: "Expenses" },
  { key: "both", label: "Both" },
];

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const expenses = payload.find((p) => p.dataKey === "expenses")?.value ?? 0;
  const net = income - expenses;
  const showIncome = payload.some((p) => p.dataKey === "income");
  const showExpenses = payload.some((p) => p.dataKey === "expenses");
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-sm font-semibold text-foreground">{label}</p>
      {showIncome && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES.income }} />
          Income<span className="ml-auto font-semibold text-foreground">{formatINR(income)}</span>
        </p>
      )}
      {showExpenses && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES.expense }} />
          Expenses<span className="ml-auto font-semibold text-foreground">{formatINR(expenses)}</span>
        </p>
      )}
      {showIncome && showExpenses && (
        <p className="mt-1 border-t border-border/60 pt-1 text-xs text-muted-foreground">
          Net<span className={`ml-auto font-semibold ${net >= 0 ? "text-green-600" : "text-rose-600"}`}>
            {" "}{net >= 0 ? "+" : "−"}{formatINR(Math.abs(net))}
          </span>
        </p>
      )}
    </div>
  );
}

export function TransactionTrendsChart({ data }: { data: TrendPoint[] }) {
  const [mode, setMode] = useState<Mode>("both");
  const showIncome = mode !== "expenses";
  const showExpenses = mode !== "income";

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">Transaction Trends</h3>
            <p className="text-xs text-muted-foreground">Income and expenses over time</p>
          </div>
          <div className="flex rounded-lg border border-border/60 p-0.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  mode === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.income} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES.income} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trendExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.expense} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={SERIES.expense} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis axisLine={false} tickLine={false} width={52} tickFormatter={formatCompactINR}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
              {showIncome && (
                <Area type="monotone" dataKey="income" stroke={SERIES.income} strokeWidth={2}
                  fill="url(#trendIncome)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
              )}
              {showExpenses && (
                <Area type="monotone" dataKey="expenses" stroke={SERIES.expense} strokeWidth={2}
                  fill="url(#trendExpense)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 flex items-center gap-4">
          {showIncome && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES.income }} />Income
            </span>
          )}
          {showExpenses && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES.expense }} />Expenses
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
