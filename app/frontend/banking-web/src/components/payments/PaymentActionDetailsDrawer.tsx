// Details drawer + receipt dialog for payments made via New Payment / Pay
// a Bill (person or bill), entirely local - no AI Assistant, no network calls.
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Wallet, RefreshCw } from "lucide-react";
import type { PaymentAction, PaymentActionStatus } from "@/models/PaymentAction";
import { paymentActionService } from "@/lib/paymentActionService";

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

interface PaymentActionDetailsDrawerProps {
  payment: PaymentAction | null;
  onClose: () => void;
  onRetried: (payment: PaymentAction) => void;
}

export function PaymentActionDetailsDrawer({ payment, onClose, onRetried }: PaymentActionDetailsDrawerProps) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    if (!payment) return;
    setRetrying(true);
    const result = await paymentActionService.retryPayment(payment.id);
    setRetrying(false);
    onRetried(result);
  };

  const title = payment?.type === "bill" ? payment.billerName : payment?.recipientName;

  return (
    <>
      <Sheet open={payment != null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="bg-card">
          {payment && (
            <>
              <SheetHeader>
                <SheetTitle>Payment Details</SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Wallet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{title}</p>
                  <Badge variant="outline" className={`mt-1 text-[10px] ${STATUS_BADGE[payment.status]}`}>{STATUS_LABEL[payment.status]}</Badge>
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">₹{payment.amount.toLocaleString()}</p>

              <dl className="mt-5 space-y-3 border-t border-border/60 pt-4 text-sm">
                {payment.transactionId && (
                  <Row label="Transaction ID" value={payment.transactionId} />
                )}
                <Row label="Payment type" value={payment.type === "bill" ? "Bill Payment" : "Personal Payment"} />
                {payment.customerId && <Row label="Customer ID" value={payment.customerId} />}
                <Row label="Payment method" value={payment.paymentMethod} />
                <Row
                  label={payment.status === "paid" ? "Paid on" : payment.status === "upcoming" ? "Due" : "Created"}
                  value={new Date(payment.paidAt ?? payment.dueDate ?? payment.createdAt).toLocaleString(undefined, { dateStyle: "medium" })}
                />
                {payment.status === "paid" && <Row label="Receipt" value="Available" />}
                {payment.status === "failed" && payment.failureReason && <Row label="Reason" value={payment.failureReason} />}
              </dl>

              <div className="mt-6 flex gap-2 border-t border-border/60 pt-4">
                {payment.status === "paid" && (
                  <Button className="flex-1" onClick={() => setReceiptOpen(true)}>View Receipt</Button>
                )}
                {payment.status === "failed" && (
                  <Button className="flex-1" onClick={retry} disabled={retrying}>
                    {retrying ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Retry Payment
                  </Button>
                )}
                <Button variant="outline" className={payment.status === "paid" || payment.status === "failed" ? "flex-1" : "w-full"} onClick={onClose}>Close</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">SecureBank</DialogTitle>
          </DialogHeader>
          {payment && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Payment Receipt</p>
              <span className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="mt-2 text-sm font-medium text-green-700">Payment Successful</p>
              <p className="mt-3 text-base font-semibold text-foreground">{title}</p>

              <dl className="mt-4 space-y-2.5 border-t border-border/60 pt-4 text-left text-sm">
                <Row label="Amount" value={`₹${payment.amount.toLocaleString()}`} />
                {payment.transactionId && <Row label="Transaction ID" value={payment.transactionId} />}
                <Row label="Payment date" value={new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })} />
                <Row label="Payment method" value={payment.paymentMethod} />
                <Row label="Status" value="Successful" />
              </dl>

              <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                ✓ Receipt generated · sent to <span className="font-medium text-foreground">bob.user@contoso.com</span>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
