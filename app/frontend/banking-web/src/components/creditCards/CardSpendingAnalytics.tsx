import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { CreditCardTransaction } from "@/models/CreditCardTransaction";

// Matches the real category strings transaction-service actually returns
// (same map used on Dashboard/TransactionAnalytics) - the previous
// "Shopping"/"Food & Dining"/"Travel" set never matched real data, so every
// category silently fell back to the gray "Other" color.
const CATEGORY_COLORS: Record<string, string> = {
  Utilities: "#3b82f6", Supplies: "#f59e0b", Software: "#10b981", Subscriptions: "#8b5cf6",
  Meals: "#ec4899", Insurance: "#06b6d4", Retail: "#f97316", Health: "#14b8a6",
  Rent: "#a855f7", Payroll: "#22c55e", Investment: "#eab308", Education: "#f43f5e",
};
const DEFAULT_CATEGORY_COLOR = "#94a3b8";

function monthKey(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, { month: "short", year: "2-digit" });
}

export function CardSpendingAnalytics({ transactions }: { transactions: CreditCardTransaction[] }) {
  const [range, setRange] = useState<"6M" | "1Y">("6M");

  const spend = transactions.filter((t) => t.flowType !== "income");

  const { categories, total } = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const t of spend) {
      const cat = t.category || "Other";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(t.amount));
    }
    const cats = Array.from(byCategory.entries()).map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] ?? DEFAULT_CATEGORY_COLOR }));
    return { categories: cats, total: cats.reduce((s, c) => s + c.value, 0) };
  }, [spend]);

  const monthly = useMemo(() => {
    const byMonth = new Map<string, { label: string; sortKey: number; value: number }>();
    for (const t of spend) {
      const d = new Date(t.timestamp);
      const k = monthKey(t.timestamp);
      const bucket = byMonth.get(k) ?? { label: k, sortKey: d.getFullYear() * 12 + d.getMonth(), value: 0 };
      bucket.value += Math.abs(t.amount);
      byMonth.set(k, bucket);
    }
    // Chronological, not insertion order - transactions aren't guaranteed to
    // arrive already sorted by month.
    const entries = Array.from(byMonth.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((b): [string, number] => [b.label, b.value]);
    const months = range === "6M" ? entries.slice(-6) : entries.slice(-12);
    return months;
  }, [spend, range]);

  const thisMonth = monthly[monthly.length - 1]?.[1] ?? 0;
  const prevMonth = monthly[monthly.length - 2]?.[1];
  const changePct = prevMonth ? ((thisMonth - prevMonth) / prevMonth) * 100 : null;
  const improved = changePct != null && changePct < 0;
  const maxMonthly = Math.max(...monthly.map(([, v]) => v), 1);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-foreground">Card Spending</h3>
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">₹{thisMonth.toLocaleString()}</p>
          {changePct != null && (
            <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${improved ? "text-green-600" : "text-red-500"}`}>
              {improved ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {Math.abs(changePct).toFixed(1)}% vs last month
            </p>
          )}

          {categories.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No spending recorded yet.</p>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categories} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={2} dataKey="value">
                      {categories.map((c) => <Cell key={c.name} fill={c.color} stroke="white" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 text-sm">
                {categories.slice().sort((a, b) => b.value - a.value).map((c) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}
                    </span>
                    <span className="text-xs font-medium text-foreground">₹{c.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Monthly Spending</h3>
            <div className="flex rounded-lg border border-border/60 p-0.5">
              {(["6M", "1Y"] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {monthly.map(([month, value]) => {
              const spentPct = value > 0 ? Math.max((value / maxMonthly) * 100, 4) : 0;
              return (
                <div key={month} className="group flex items-center gap-2">
                  <span className="w-8 shrink-0 text-xs text-muted-foreground">{month}</span>
                  <div className="flex h-2 flex-1 overflow-hidden rounded-full" title={value > 0 ? `₹${value.toLocaleString()} spent` : "No spending"}>
                    {value > 0 ? (
                      <>
                        <div className="h-full rounded-l-full bg-red-500 transition-all duration-700" style={{ width: `${spentPct}%` }} />
                        <div className="h-full flex-1 rounded-r-full bg-green-500/70 transition-all duration-700" />
                      </>
                    ) : (
                      <div className="h-full w-full rounded-full bg-green-500" />
                    )}
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">₹{Math.round(value / 1000)}K</span>
                </div>
              );
            })}
            {monthly.length === 0 && <p className="text-sm text-muted-foreground">No spending history yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
