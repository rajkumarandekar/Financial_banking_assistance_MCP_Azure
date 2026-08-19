// Expense Categories Analysis - the sorted category list (unchanged concept
// from the original page) plus two compact side info-blocks and a per-
// category drill-down Sheet, all reading from the same CategoryRow[] /
// transaction list so nothing here recomputes its own numbers.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Trophy, Receipt, Landmark, CreditCard as CreditCardIcon } from "lucide-react";
import { formatINR } from "@/lib/chartTokens";
import type { CategoryRow } from "@/lib/transactionAnalytics";
import type { Payment } from "@/models/Payments";

interface ExpenseCategoriesAnalysisProps {
  breakdown: CategoryRow[];
  transactions: Payment[];
  topCategory: CategoryRow | null;
  largestTransaction: Payment | null;
  totalMonthlyEmi: number;
  activeLoanCount: number;
  creditCardSpending: number;
  onViewTransactions: (category: string) => void;
}

export function ExpenseCategoriesAnalysis({
  breakdown, transactions, topCategory, largestTransaction, totalMonthlyEmi, activeLoanCount, creditCardSpending, onViewTransactions,
}: ExpenseCategoriesAnalysisProps) {
  const [selected, setSelected] = useState<CategoryRow | null>(null);

  const detail = useMemo(() => {
    if (!selected) return null;
    const catTx = transactions
      .filter((t) => t.flowType !== "income" && (t.category || "Other") === selected.category)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const largest = catTx.reduce((max, t) => (t.amount > max.amount ? t : max), catTx[0]);
    const avg = catTx.length > 0 ? selected.amount / catTx.length : 0;
    return { transactions: catTx, largest, avg };
  }, [selected, transactions]);

  return (
    <Card id="expense-categories" className="bg-card/50 backdrop-blur border-border/50 scroll-mt-6">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">Expense Categories Analysis</h3>

        {breakdown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No expenses recorded in this period.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="min-w-0 space-y-5">
              {breakdown.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => setSelected(cat)}
                  className="block w-full space-y-2 rounded-lg text-left transition-opacity hover:opacity-80"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium text-foreground">{cat.category}</span>
                      <span className="text-xs text-muted-foreground">{cat.count} txn{cat.count === 1 ? "" : "s"}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-foreground">{formatINR(cat.amount)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                  </div>
                  <p className="text-sm text-muted-foreground">{cat.percentage}% of total expenses</p>
                </button>
              ))}

              {totalMonthlyEmi > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-border/70 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                      <Landmark className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">Loan EMI <span className="font-normal text-muted-foreground">· Debt / Loan Payment</span></p>
                      <p className="text-xs text-muted-foreground">{activeLoanCount} active loan{activeLoanCount === 1 ? "" : "s"} · not part of expense %</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{formatINR(totalMonthlyEmi)}/mo</span>
                    <Link to="/loans" className="text-xs font-medium text-primary hover:underline">View Loans</Link>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {topCategory && (
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Trophy className="h-3.5 w-3.5" />Top Spending Category
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">{topCategory.category}</p>
                  <p className="text-base font-bold tabular-nums text-foreground">{formatINR(topCategory.amount)}</p>
                  <p className="text-xs text-muted-foreground">{topCategory.percentage}% of total expenses</p>
                </div>
              )}
              {largestTransaction && (
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" />Largest Transaction
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">{largestTransaction.description || largestTransaction.category || "Transaction"}</p>
                  <p className="text-base font-bold tabular-nums text-foreground">{formatINR(largestTransaction.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(largestTransaction.timestamp).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              )}
              {creditCardSpending > 0 && (
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <CreditCardIcon className="h-3.5 w-3.5" />Credit Card Spending
                  </p>
                  <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">{formatINR(creditCardSpending)}</p>
                  <Link to="/credit-cards" className="text-xs font-medium text-primary hover:underline">Manage cards</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <Sheet open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="bg-card overflow-y-auto">
          {selected && detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selected.color }} />{selected.category}
                </SheetTitle>
                <SheetDescription>{selected.percentage}% of total expenses this period</SheetDescription>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground">Total Spent</p>
                  <p className="text-lg font-bold text-foreground">{formatINR(selected.amount)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground">Transactions</p>
                  <p className="text-lg font-bold text-foreground">{selected.count}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground">Average Transaction</p>
                  <p className="text-lg font-bold text-foreground">{formatINR(detail.avg)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[11px] text-muted-foreground">Largest Transaction</p>
                  <p className="text-lg font-bold text-foreground">{detail.largest ? formatINR(detail.largest.amount) : "—"}</p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-semibold text-foreground">Recent Transactions</p>
                <ul className="mt-2 divide-y divide-border/60">
                  {detail.transactions.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{t.description || t.recipientName || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-foreground">{formatINR(t.amount)}</span>
                    </li>
                  ))}
                  {detail.transactions.length === 0 && (
                    <li className="py-2 text-sm text-muted-foreground">No transactions in this period.</li>
                  )}
                </ul>
              </div>

              <Button
                className="mt-5 w-full"
                variant="outline"
                onClick={() => { onViewTransactions(selected.category); setSelected(null); }}
              >
                View Transactions
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
