// Human-action credit card bill payment: choose amount (full/minimum/
// custom) -> review -> confirm -> processing -> success. Executes for real
// via creditCardService.payCardBill (payment-service + account-service).
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";
import { minimumPayment, payCardBill } from "@/lib/creditCardService";
import type { CardPaymentRecord } from "@/models/CreditCardCenter";
import type { CreditCard } from "@/models/CreditCard";

type EffectiveCard = CreditCard & { frozen: boolean };
type Choice = "full" | "minimum" | "custom";
type Phase = "choose" | "review" | "processing" | "success" | "failed";

interface PayCardBillDrawerProps {
  card: EffectiveCard | null;
  onClose: () => void;
  onPaid: () => void;
}

export function PayCardBillDrawer({ card, onClose, onPaid }: PayCardBillDrawerProps) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [choice, setChoice] = useState<Choice>("full");
  const [customAmount, setCustomAmount] = useState("");
  const [record, setRecord] = useState<CardPaymentRecord | null>(null);

  if (!card) return <Sheet open={false} onOpenChange={() => onClose()}><SheetContent /></Sheet>;

  const minDue = minimumPayment(card.balance);
  const amount = choice === "full" ? card.balance : choice === "minimum" ? minDue : Number(customAmount) || 0;

  const customError =
    choice === "custom" && customAmount !== ""
      ? Number(customAmount) < 0
        ? "Amount cannot be negative."
        : Number(customAmount) > card.balance
          ? "Amount cannot exceed statement balance."
          : Number(customAmount) < minDue
            ? `Must be at least the minimum payment (₹${minDue.toLocaleString()}).`
            : null
      : null;

  const canReview = amount > 0 && !customError;

  const close = () => {
    onClose();
    setTimeout(() => { setPhase("choose"); setChoice("full"); setCustomAmount(""); setRecord(null); }, 250);
  };

  const confirm = async () => {
    setPhase("processing");
    try {
      const r = await payCardBill(card, amount, choice, "Savings Account •••• 9021");
      setRecord(r);
      setPhase("success");
      onPaid();
    } catch {
      setPhase("failed");
    }
  };

  return (
    <Sheet open={card != null} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex flex-col gap-0 bg-card sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pay Credit Card Bill</SheetTitle>
          <SheetDescription>{card.name} · •••• {card.number.slice(-4)}</SheetDescription>
        </SheetHeader>

        {phase === "choose" && (
          <div className="mt-4 flex-1 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["full", "minimum", "custom"] as Choice[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setChoice(c)}
                  className={`rounded-lg border p-2.5 text-center text-xs font-medium transition-colors ${
                    choice === c ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c === "full" ? "Full Balance" : c === "minimum" ? "Minimum" : "Custom"}
                </button>
              ))}
            </div>

            {choice === "custom" ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">Payment Amount</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
                  <Input type="number" min="0" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="0.00" className="pl-7 text-lg font-semibold" autoFocus />
                </div>
                {customError && <p className="text-xs font-medium text-red-600">{customError}</p>}
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-3xl font-bold text-foreground tabular-nums">₹{amount.toLocaleString()}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/60 p-3 text-xs">
              <div><p className="text-muted-foreground">Minimum</p><p className="font-medium text-foreground">₹{minDue.toLocaleString()}</p></div>
              <div><p className="text-muted-foreground">Statement balance</p><p className="font-medium text-foreground">₹{card.balance.toLocaleString()}</p></div>
              <div><p className="text-muted-foreground">Available credit</p><p className="font-medium text-foreground">₹{Math.max(card.limit - card.balance, 0).toLocaleString()}</p></div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Payment Account</p>
              <div className="rounded-lg border border-border/60 p-3 text-sm text-foreground">Savings Account •••• 9021</div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Payment Date</p>
              <div className="rounded-lg border border-border/60 p-3 text-sm text-foreground">Today</div>
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="mt-4 flex-1 space-y-4">
            <p className="text-sm font-semibold text-foreground">Review Payment</p>
            <dl className="space-y-3 rounded-lg border border-border/60 p-4 text-sm">
              <Row label="Card" value={`${card.name} •••• ${card.number.slice(-4)}`} />
              <Row label="Amount" value={`₹${amount.toLocaleString()}`} />
              <Row label="Payment Account" value="Savings Account •••• 9021" />
              <Row label="Payment Date" value="Today" />
            </dl>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Please wait while we process your payment.</p>
          </div>
        )}

        {phase === "success" && record && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-8 w-8" /></span>
            <div>
              <p className="text-lg font-semibold text-foreground">Payment Successful</p>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">₹{record.amount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">paid · {card.name} •••• {card.number.slice(-4)}</p>
            </div>
            <dl className="w-full space-y-2 rounded-lg border border-border/60 p-4 text-left text-sm">
              <Row label="Transaction ID" value={record.transactionId} />
              <Row label="Paid on" value={new Date(record.paidAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} />
            </dl>
          </div>
        )}

        {phase === "failed" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-lg font-semibold text-foreground">Payment Failed</p>
            <p className="text-sm text-muted-foreground">Payment could not be processed. No money was transferred.</p>
          </div>
        )}

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          {phase === "choose" && (
            <Button className="w-full" disabled={!canReview} onClick={() => setPhase("review")}>Continue</Button>
          )}
          {phase === "review" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("choose")}>Back</Button>
              <Button className="flex-1" onClick={confirm}>Confirm Payment</Button>
            </div>
          )}
          {phase === "success" && <Button className="w-full" onClick={close}>Done</Button>}
          {phase === "failed" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={close}>Cancel</Button>
              <Button className="flex-1" onClick={confirm}>Try Again</Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
