// Human-action person-to-person payment flow: form -> review -> confirm ->
// processing -> success/failure, all executed via paymentActionService against
// local state only. No AI Assistant involvement anywhere in this file.
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Search, UserPlus, Banknote, CreditCard, Calendar } from "lucide-react";
import { SAVED_RECIPIENTS, type PaymentAction } from "@/models/PaymentAction";
import { paymentActionService } from "@/lib/paymentActionService";

type Phase = "form" | "review" | "processing" | "success" | "failed";
type Method = "bank" | "debit";

const AVAILABLE_BALANCE = 185000;

interface NewPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (payment: PaymentAction) => void;
}

export function NewPaymentDrawer({ open, onOpenChange, onCompleted }: NewPaymentDrawerProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState<{ name: string; email: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("bank");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PaymentAction | null>(null);

  const filteredRecipients = useMemo(
    () => SAVED_RECIPIENTS.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const amountNum = Number(amount) || 0;
  const amountError = amountNum > 0 && amountNum > AVAILABLE_BALANCE ? "Amount exceeds your available balance." : null;
  const canReview = recipient != null && amountNum > 0 && !amountError && (!scheduleLater || scheduleDate);

  const reset = () => {
    setPhase("form");
    setQuery("");
    setRecipient(null);
    setAmount("");
    setMethod("bank");
    setScheduleLater(false);
    setScheduleDate("");
    setNote("");
    setPayment(null);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 250);
  };

  const methodLabel = method === "bank" ? "Primary Bank Account" : "Debit Card •••• 4821";

  const confirmAndPay = async () => {
    if (!recipient) return;
    if (!scheduleLater) setPhase("processing");
    try {
      const result = await paymentActionService.createPersonPayment({
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        amount: amountNum,
        paymentMethod: methodLabel,
        scheduleDate: scheduleLater ? scheduleDate : null,
        note: note.trim() || undefined,
      });
      setPayment(result);
      setPhase(result.status === "failed" ? "failed" : "success");
      onCompleted(result);
    } catch {
      setPhase("failed");
    }
  };

  const retry = async () => {
    if (!payment) return;
    setPhase("processing");
    try {
      const result = await paymentActionService.retryPayment(payment.id);
      setPayment(result);
      setPhase(result.status === "paid" ? "success" : "failed");
      onCompleted(result);
    } catch {
      setPhase("failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent className="flex flex-col gap-0 bg-card sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Payment</SheetTitle>
          <SheetDescription>Send money securely to a person or beneficiary.</SheetDescription>
        </SheetHeader>

        {phase === "form" && (
          <div className="mt-4 flex-1 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Recipient</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setRecipient(null); }}
                  placeholder="Search recipient..."
                  className="pl-9"
                />
              </div>
              <div className="space-y-1.5">
                {filteredRecipients.map((r) => (
                  <button
                    key={r.email}
                    onClick={() => { setRecipient(r); setQuery(r.name); }}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      recipient?.email === r.email ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => query.trim() && setRecipient({ name: query.trim(), email: "" })}
                  disabled={!query.trim() || filteredRecipients.length > 0}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <UserPlus className="h-4 w-4" /> Add new recipient
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Amount</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
                <Input
                  type="number" min="0" inputMode="decimal"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className="pl-7 text-2xl font-bold h-14"
                />
              </div>
              <p className="text-xs text-muted-foreground">Available balance ₹{AVAILABLE_BALANCE.toLocaleString()}</p>
              {amountError && <p className="text-xs font-medium text-red-600">{amountError}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Payment method</p>
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="space-y-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${method === "bank" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  <RadioGroupItem value="bank" id="method-bank" />
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Primary Bank Account</p>
                    <p className="text-xs text-muted-foreground">Available balance: ₹{AVAILABLE_BALANCE.toLocaleString()}</p>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${method === "debit" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  <RadioGroupItem value="debit" id="method-debit" />
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Debit Card •••• 4821</p>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Payment date</p>
              <RadioGroup value={scheduleLater ? "later" : "now"} onValueChange={(v) => setScheduleLater(v === "later")} className="space-y-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${!scheduleLater ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  <RadioGroupItem value="now" id="date-now" />
                  <span className="text-sm font-medium text-foreground">Pay now</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${scheduleLater ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  <RadioGroupItem value="later" id="date-later" />
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Schedule for later</span>
                </label>
              </RadioGroup>
              {scheduleLater && (
                <Input type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setScheduleDate(e.target.value)} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-sm font-medium text-foreground">Note (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's this payment for?" rows={2} />
            </div>

          </div>
        )}

        {phase === "review" && recipient && (
          <div className="mt-4 flex-1 space-y-4">
            <p className="text-sm font-semibold text-foreground">Review Payment</p>
            <dl className="space-y-3 rounded-lg border border-border/60 p-4 text-sm">
              <Row label="Recipient" value={recipient.name} />
              <Row label="Amount" value={`₹${amountNum.toLocaleString()}`} />
              <Row label="Payment method" value={methodLabel} />
              <Row label="Payment date" value={scheduleLater ? new Date(scheduleDate).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Today"} />
              {note && <Row label="Note" value={note} />}
            </dl>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="text-base font-semibold text-foreground">Processing payment...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while we process your payment.</p>
            </div>
          </div>
        )}

        {phase === "success" && payment && (
          <SuccessView payment={payment} scheduled={payment.status === "upcoming"} />
        )}

        {phase === "failed" && payment && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <XCircle className="h-8 w-8" />
            </span>
            <div>
              <p className="text-lg font-semibold text-foreground">Payment Failed</p>
              <p className="text-sm text-muted-foreground mt-1">We couldn't complete this payment.</p>
              <p className="text-sm text-muted-foreground">No money was transferred.</p>
            </div>
          </div>
        )}

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          {phase === "form" && (
            <Button className="w-full" disabled={!canReview} onClick={() => setPhase("review")}>Continue to Review</Button>
          )}
          {phase === "review" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("form")}>Back</Button>
              <Button className="flex-1" onClick={confirmAndPay}>Confirm & Pay ₹{amountNum.toLocaleString()}</Button>
            </div>
          )}
          {phase === "success" && (
            <Button className="w-full" onClick={close}>Done</Button>
          )}
          {phase === "failed" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={close}>Cancel</Button>
              <Button className="flex-1" onClick={retry}>Try Again</Button>
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

function SuccessView({ payment, scheduled }: { payment: PaymentAction; scheduled: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
        <CheckCircle2 className="h-8 w-8" />
      </span>
      <div>
        <p className="text-lg font-semibold text-foreground">{scheduled ? "Payment Scheduled" : "Payment Successful"}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">₹{payment.amount.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">{scheduled ? "will be sent to" : "sent to"} {payment.recipientName}</p>
      </div>
      <dl className="w-full space-y-2 rounded-lg border border-border/60 p-4 text-left text-sm">
        {payment.transactionId && <Row label="Transaction ID" value={payment.transactionId} />}
        <Row
          label={scheduled ? "Scheduled for" : "Paid on"}
          value={new Date(payment.paidAt ?? payment.dueDate ?? payment.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: scheduled ? undefined : "short" })}
        />
        <Row label="Payment method" value={payment.paymentMethod} />
      </dl>
      {!scheduled && <p className="text-xs font-medium text-green-700">✓ Receipt generated successfully</p>}
    </div>
  );
}
