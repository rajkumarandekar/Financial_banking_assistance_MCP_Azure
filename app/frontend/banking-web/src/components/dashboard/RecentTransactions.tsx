// Recent activity as a scannable table with flow filters and a detail sheet.
//
// Rows stay a single grid (not per-row cards) so the eye can run down the
// amount column. Clicking a row opens a detail sheet rather than navigating
// away, which keeps the dashboard as the reader's home base.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Zap, Package, Code2, Repeat, UtensilsCrossed, ShieldCheck, ShoppingBag,
  HeartPulse, Home, Banknote, TrendingUp, GraduationCap, ArrowRight, Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatINR } from "@/lib/chartTokens";

interface TxLike {
  id: string;
  description: string;
  category?: string;
  timestamp: string;
  amount: number;
  flowType?: string;
  // The transaction service leaves status null for settled entries, so this is
  // genuinely nullable - typing it as `string` is what crashed this component.
  status?: string | null;
  recipientName?: string;
}

const CATEGORY_ICON: Record<string, typeof Zap> = {
  Utilities: Zap,
  Supplies: Package,
  Software: Code2,
  Subscriptions: Repeat,
  Meals: UtensilsCrossed,
  Insurance: ShieldCheck,
  Retail: ShoppingBag,
  Health: HeartPulse,
  Rent: Home,
  Payroll: Banknote,
  Investment: TrendingUp,
  Education: GraduationCap,
};

type Filter = "All" | "Income" | "Expense" | "Pending";
const FILTERS: Filter[] = ["All", "Income", "Expense", "Pending"];

const normalizeStatus = (status?: string | null) => (status ?? "").toLowerCase();
const isPending = (t: TxLike) => normalizeStatus(t.status) === "pending";

function statusVariant(status?: string | null) {
  return normalizeStatus(status) === "pending"
    ? "border-amber-300 bg-amber-50 text-amber-700"
    : "border-green-300 bg-green-50 text-green-700";
}

interface RecentTransactionsProps {
  transactions: TxLike[];
  categoryFilter: string | null;
  onClearFilter: () => void;
}

export function RecentTransactions({ transactions, categoryFilter, onClearFilter }: RecentTransactionsProps) {
  const [filter, setFilter] = useState<Filter>("All");
  const [selected, setSelected] = useState<TxLike | null>(null);

  const visible = useMemo(() => {
    let rows = categoryFilter ? transactions.filter((t) => (t.category || "Other") === categoryFilter) : transactions;
    if (filter === "Income") rows = rows.filter((t) => t.flowType === "income");
    if (filter === "Expense") rows = rows.filter((t) => t.flowType !== "income");
    if (filter === "Pending") rows = rows.filter(isPending);
    return rows.slice(0, 6);
  }, [transactions, categoryFilter, filter]);

  return (
    <>
      <Card className="flex h-full flex-col border-border/70">
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">Recent Transactions</h3>
            <Link to="/analytics" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter transactions">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {f}
              </button>
            ))}
            {categoryFilter && (
              <button onClick={onClearFilter} className="ml-auto text-xs font-medium text-primary hover:underline">
                {categoryFilter} · clear
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
              No transactions match this view.
            </p>
          ) : (
            <div className="mt-3 flex-1">
              <div className="hidden grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-2 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid">
                <span className="sr-only">Icon</span>
                <span>Merchant</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Status</span>
              </div>
              <ul className="divide-y divide-border/60">
                {visible.map((t) => {
                  const income = t.flowType === "income";
                  const Icon = income ? Wallet : CATEGORY_ICON[t.category ?? ""] ?? ShoppingBag;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setSelected(t)}
                        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[auto_1fr_auto_auto_auto] sm:gap-4"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${income ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{t.description}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {t.category ?? "Other"}
                            <span className="sm:hidden"> · {new Date(t.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          </span>
                        </span>
                        <span className="hidden text-sm text-muted-foreground sm:block">
                          {new Date(t.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        <span className={`text-right text-sm font-semibold tabular-nums ${income ? "text-green-600" : "text-foreground"}`}>
                          {income ? "+" : "−"}{formatINR(Math.abs(t.amount))}
                        </span>
                        <span className="hidden justify-end sm:flex">
                          {t.status ? (
                            <Badge variant="outline" className={`text-[10px] capitalize ${statusVariant(t.status)}`}>{t.status}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="bg-card">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.description}</SheetTitle>
                <SheetDescription>{selected.category ?? "Other"}</SheetDescription>
              </SheetHeader>
              <dl className="mt-6 space-y-4">
                <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                  <dt className="text-sm text-muted-foreground">Amount</dt>
                  <dd className={`text-xl font-bold tabular-nums ${selected.flowType === "income" ? "text-green-600" : "text-foreground"}`}>
                    {selected.flowType === "income" ? "+" : "−"}{formatINR(Math.abs(selected.amount))}
                  </dd>
                </div>
                {[
                  ["Date", new Date(selected.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })],
                  ["Direction", selected.flowType === "income" ? "Money in" : "Money out"],
                  ["Reference", selected.id],
                  ...(selected.recipientName ? [["Recipient", selected.recipientName] as const] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-3">
                    <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between">
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd>
                    {selected.status ? (
                      <Badge variant="outline" className={`capitalize ${statusVariant(selected.status)}`}>{selected.status}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not reported</span>
                    )}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
