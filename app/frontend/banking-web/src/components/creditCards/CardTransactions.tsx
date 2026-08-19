import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ShoppingBag, ArrowDownCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { CreditCardTransaction } from "@/models/CreditCardTransaction";
import type { CreditCard } from "@/models/CreditCard";

type Filter = "all" | "purchases" | "payments" | "refunds" | "fees";

const STATUS_BADGE: Record<string, string> = {
  paid: "border-green-200 bg-green-50 text-green-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  refunded: "border-blue-200 bg-blue-50 text-blue-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

function classify(t: CreditCardTransaction): Filter {
  if (t.category === "Payment" || t.flowType === "income") return "payments";
  if (t.category?.toLowerCase().includes("refund")) return "refunds";
  if (t.category?.toLowerCase().includes("fee")) return "fees";
  return "purchases";
}

interface CardTransactionsProps {
  transactions: CreditCardTransaction[];
  cards: CreditCard[];
}

export function CardTransactions({ transactions, cards }: CardTransactionsProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => filter === "all" || classify(t) === filter)
      .filter((t) => !query.trim() || t.description.toLowerCase().includes(query.toLowerCase()) || t.recipientName?.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, filter, query]);

  const visible = filtered.slice(0, 8);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Recent Card Transactions</h3>
          <div className="relative w-full sm:w-auto sm:max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transactions..." className="h-8 pl-8 text-xs" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "purchases", "payments", "refunds", "fees"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No recent transactions.</p>
        ) : (
          <div className="mt-3 divide-y divide-border/50">
            {visible.map((t) => {
              const isCredit = t.flowType === "income";
              const status = (t.status ?? "paid").toLowerCase();
              const card = t.cardId ? cardById.get(t.cardId) : undefined;
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isCredit ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {isCredit ? <ArrowDownCircle className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.recipientName || t.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.category} · {new Date(t.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {card && <> · {card.name} •••• {card.number.slice(-4)}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${isCredit ? "text-green-600" : "text-foreground"}`}>
                      {isCredit ? "+" : "-"}₹{Math.abs(t.amount).toLocaleString()}
                    </p>
                    <Badge variant="outline" className={`mt-0.5 text-[10px] capitalize ${STATUS_BADGE[status] ?? STATUS_BADGE.paid}`}>{status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {filtered.length > visible.length && (
          <Link to="/analytics" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">View All Transactions →</Link>
        )}
      </CardContent>
    </Card>
  );
}
