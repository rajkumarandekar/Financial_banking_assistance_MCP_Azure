// "Your Payment Activity" - payments created via New Payment / Pay a Bill.
// Kept as its own section (separate from the real payment-service
// KPIs/table above it on the page) so these locally-processed amounts
// never get blended into real account figures shown elsewhere in the app.
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Wallet, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import type { PaymentAction, PaymentActionStatus } from "@/models/PaymentAction";
import { usePaymentActions } from "@/lib/paymentActionService";
import { computePaymentActionSummary } from "@/lib/paymentActionDerived";
import { PaymentActionDetailsDrawer } from "@/components/payments/PaymentActionDetailsDrawer";

const STATUS_BADGE: Record<PaymentActionStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  upcoming: "border-blue-200 bg-blue-50 text-blue-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-border bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<PaymentActionStatus, string> = {
  pending: "Pending", upcoming: "Upcoming", paid: "Paid", failed: "Failed", cancelled: "Cancelled",
};

const HISTORY_PAGE_SIZE = 5;

export function PaymentActionSection() {
  const payments = usePaymentActions();
  const [selected, setSelected] = useState<PaymentAction | null>(null);
  const [historyPage, setHistoryPage] = useState(0);

  if (payments.length === 0) return null;

  const summary = computePaymentActionSummary(payments);
  const upcoming = payments.filter((p) => p.status === "upcoming");
  const history = payments
    .filter((p) => p.status === "paid" || p.status === "failed")
    .sort((a, b) => new Date(b.paidAt ?? b.createdAt).getTime() - new Date(a.paidAt ?? a.createdAt).getTime());

  const historyPageCount = Math.max(Math.ceil(history.length / HISTORY_PAGE_SIZE), 1);
  const currentHistoryPage = Math.min(historyPage, historyPageCount - 1);
  const visibleHistory = history.slice(currentHistoryPage * HISTORY_PAGE_SIZE, currentHistoryPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Your Payment Activity</h2>

      <div className="grid grid-cols-3 divide-x rounded-lg border border-border/60 bg-card/50">
        <Stat label="Paid" value={`₹${summary.paidTotal.toLocaleString()}`} sub={`${summary.paidCount} payment${summary.paidCount === 1 ? "" : "s"}`} />
        <Stat label="Upcoming" value={`₹${summary.upcomingTotal.toLocaleString()}`} sub={`${summary.upcomingCount} scheduled`} />
        <Stat label="Failed" value={`₹${summary.failedTotal.toLocaleString()}`} sub={`${summary.failedCount} attempt${summary.failedCount === 1 ? "" : "s"}`} />
      </div>

      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Upcoming</p>
          <div className="space-y-2">
            {upcoming.map((p) => (
              <PaymentRow key={p.id} payment={p} onSelect={setSelected} />
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Payment History</p>
            {historyPageCount > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Page {currentHistoryPage + 1} of {historyPageCount}</span>
                <Button
                  size="icon" variant="outline" className="h-6 w-6"
                  disabled={currentHistoryPage === 0}
                  onClick={() => setHistoryPage((p) => Math.max(p - 1, 0))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon" variant="outline" className="h-6 w-6"
                  disabled={currentHistoryPage >= historyPageCount - 1}
                  onClick={() => setHistoryPage((p) => Math.min(p + 1, historyPageCount - 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {visibleHistory.map((p) => (
              <PaymentRow key={p.id} payment={p} onSelect={setSelected} />
            ))}
          </div>
        </div>
      )}

      <PaymentActionDetailsDrawer payment={selected} onClose={() => setSelected(null)} onRetried={(p) => setSelected(p)} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function PaymentRow({ payment, onSelect }: { payment: PaymentAction; onSelect: (p: PaymentAction) => void }) {
  const title = payment.type === "bill" ? payment.billerName : payment.recipientName;
  const Icon = payment.status === "failed" ? ShieldAlert : payment.type === "bill" ? ShoppingBag : Wallet;
  const date = payment.paidAt ?? payment.dueDate ?? payment.createdAt;

  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 p-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${payment.status === "failed" ? "bg-rose-100 text-rose-600" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">
            {payment.type === "bill" ? "Bill Payment" : "Personal Payment"}
            {payment.customerId ? ` · Customer ID: ${payment.customerId}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-foreground">₹{payment.amount.toLocaleString()}</p>
          <Badge variant="outline" className={`mt-1 text-[10px] ${STATUS_BADGE[payment.status]}`}>{STATUS_LABEL[payment.status]}</Badge>
        </div>
        <button onClick={() => onSelect(payment)} className="ml-2 shrink-0 text-xs font-medium text-primary hover:underline">
          View
        </button>
      </CardContent>
    </Card>
  );
}
