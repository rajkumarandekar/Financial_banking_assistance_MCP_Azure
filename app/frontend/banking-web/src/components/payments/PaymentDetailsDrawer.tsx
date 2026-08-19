// Payment detail drawer.
//
// There is no REST/GraphQL endpoint on the frontend that executes, retries, or
// generates a receipt for a payment - every one of those actions happens
// through the AI agent (see app/backend's payment tools). So "Pay Now",
// "Retry Payment", and "Download Receipt" navigate to /assistant with a real,
// specific composed request instead of being dead buttons or a fake success
// toast - a genuine action, not a decorative one.
import { useNavigate } from "react-router-dom";
import { CreditCard, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeStatus, splitDescription, STATUS_LABEL, type PaymentStatus } from "@/lib/payments";
import { formatINR } from "@/lib/chartTokens";
import type { Payment } from "@/models/Payments";

const STATUS_BADGE: Record<PaymentStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-border bg-muted text-muted-foreground",
};

interface PaymentDetailsDrawerProps {
  payment: Payment | null;
  onClose: () => void;
}

function promptFor(p: Payment, s: PaymentStatus): string {
  if (s === "failed") return `Retry my failed payment: ${p.description} for ${formatINR(p.amount)} to ${p.recipientName ?? "the recipient"}.`;
  if (s === "paid") return `Send me a receipt for my payment: ${p.description}, ${formatINR(p.amount)}, paid on ${new Date(p.timestamp).toLocaleDateString()}.`;
  return `Pay my ${p.description} of ${formatINR(p.amount)} to ${p.recipientName ?? "the recipient"}.`;
}

export function PaymentDetailsDrawer({ payment, onClose }: PaymentDetailsDrawerProps) {
  const navigate = useNavigate();

  const goToAssistant = () => {
    if (!payment) return;
    const prompt = promptFor(payment, normalizeStatus(payment.status));
    onClose();
    navigate("/assistant", { state: { prefill: prompt } });
  };

  return (
    <Sheet open={payment != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="bg-card">
        {payment && (() => {
          const status = normalizeStatus(payment.status);
          const { name, reference } = splitDescription(payment.description);
          return (
            <>
              <SheetHeader>
                <SheetTitle>Payment Details</SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{name}</p>
                  <Badge variant="outline" className={`mt-1 text-[10px] ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</Badge>
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">{formatINR(payment.amount)}</p>

              <dl className="mt-5 space-y-3 border-t border-border/60 pt-4 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Biller</dt>
                  <dd className="text-right font-medium text-foreground">{payment.recipientName || "—"}</dd>
                </div>
                {reference && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="text-right font-medium text-foreground">{reference}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{status === "paid" ? "Paid on" : "Date"}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {new Date(payment.timestamp).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Payment Method</dt>
                  <dd className="text-right font-medium text-foreground">{payment.paymentType || "—"}</dd>
                </div>
                {payment.category && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd className="text-right font-medium text-foreground">{payment.category}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 border-t border-border/60 pt-4">
                {status === "pending" && (
                  <Button className="w-full justify-between" onClick={goToAssistant}>
                    Pay Now <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {status === "failed" && (
                  <Button variant="outline" className="w-full justify-between text-rose-600 hover:text-rose-600" onClick={goToAssistant}>
                    Retry Payment <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {status === "paid" && (
                  <Button variant="outline" className="w-full justify-between" onClick={goToAssistant}>
                    Download Receipt <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <p className="mt-2 text-center text-[11px] text-muted-foreground">Opens SecureBank AI to complete this action.</p>
              </div>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}
