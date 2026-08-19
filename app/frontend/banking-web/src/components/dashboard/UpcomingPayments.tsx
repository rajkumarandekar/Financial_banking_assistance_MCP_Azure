// Upcoming obligations, with the *next* one promoted to a hero block - that's
// the only one the reader can act on today. The rest stay a compact timeline.
// Real EMI installments only; no fabricated card or insurance due dates, since
// those aren't modelled by any service yet.
import { Link } from "react-router-dom";
import { CalendarClock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/chartTokens";

export interface UpcomingItem {
  key: string;
  label: string;
  amount: number;
  dueDate: string;
}

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

function urgency(days: number) {
  if (days <= 0) return { text: "Due today", className: "text-rose-600", dot: "bg-rose-500" };
  if (days <= 3) return { text: `In ${days} day${days === 1 ? "" : "s"}`, className: "text-rose-600", dot: "bg-rose-500" };
  if (days <= 7) return { text: `In ${days} days`, className: "text-amber-600", dot: "bg-amber-500" };
  return { text: `In ${days} days`, className: "text-muted-foreground", dot: "bg-primary" };
}

const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function UpcomingPayments({ items }: { items: UpcomingItem[] }) {
  const [next, ...rest] = items;

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Upcoming Payments</h3>
          <Link to="/loans" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!next ? (
          <p className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
            No upcoming payments due.
          </p>
        ) : (
          <>
            {/* Next payment - the actionable one */}
            <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Next payment</p>
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{next.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Due {shortDate(next.dueDate)} ·{" "}
                    <span className={urgency(daysUntil(next.dueDate)).className}>
                      {urgency(daysUntil(next.dueDate)).text}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold tabular-nums text-foreground">{formatINR(next.amount)}</p>
                </div>
              </div>
              <Button asChild size="sm" className="mt-3 w-full">
                <Link to="/payments">Manage payment</Link>
              </Button>
            </div>

            {rest.length > 0 && (
              <ul className="relative mt-5 flex-1 space-y-4 pl-5">
                <span className="absolute left-[5px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
                {rest.map((item) => {
                  const u = urgency(daysUntil(item.dueDate));
                  return (
                    <li key={item.key} className="relative flex items-start justify-between gap-3">
                      <span className={`absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${u.dot}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {shortDate(item.dueDate)} · <span className={u.className}>{u.text}</span>
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatINR(item.amount)}</p>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-5 flex items-center gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {items.length} scheduled · {formatINR(items.reduce((s, i) => s + i.amount, 0))} total
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
