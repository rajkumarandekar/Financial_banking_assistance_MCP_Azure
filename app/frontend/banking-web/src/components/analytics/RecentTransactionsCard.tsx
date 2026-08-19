// Compact 5-row activity feed scoped to the page's current filters. "View
// All" hands off to the Payments screen's full, paginated table rather than
// duplicating it here.
import { Link } from "react-router-dom";
import { ArrowRight, Wallet, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/chartTokens";
import type { Payment } from "@/models/Payments";

interface RecentTransactionsCardProps {
  transactions: Payment[];
  categoryFilter: string | null;
  onClearFilter: () => void;
}

export function RecentTransactionsCard({ transactions, categoryFilter, onClearFilter }: RecentTransactionsCardProps) {
  const filtered = categoryFilter ? transactions.filter((t) => (t.category || "Other") === categoryFilter) : transactions;
  const visible = [...filtered]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <Card id="recent-transactions" className="bg-card/50 backdrop-blur border-border/50 scroll-mt-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Recent Transactions</h3>
          <Link to="/payments#all-payments" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {categoryFilter && (
          <button onClick={onClearFilter} className="mt-2 text-xs font-medium text-primary hover:underline">
            Filtered by {categoryFilter} · clear
          </button>
        )}

        {visible.length === 0 ? (
          <p className="mt-6 py-6 text-center text-sm text-muted-foreground">No transactions in this period.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {visible.map((t) => {
              const income = t.flowType === "income";
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${income ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {income ? <Wallet className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.description || t.recipientName || "Transaction"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.category ?? "Other"} · {new Date(t.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${income ? "text-green-600" : "text-foreground"}`}>
                    {income ? "+" : "−"}{formatINR(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
