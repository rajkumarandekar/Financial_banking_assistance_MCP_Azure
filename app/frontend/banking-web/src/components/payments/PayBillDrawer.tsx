// Human-action bill-payment flow: category -> biller -> details -> review ->
// pay -> processing -> success/failure. Deliberately separate from
// NewPaymentDrawer (person payments) per spec - two distinct flows, not one
// generic form. No AI Assistant involvement anywhere in this file.
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, XCircle, Banknote, ChevronLeft } from "lucide-react";
import { BILL_CATEGORIES, type PaymentAction } from "@/models/PaymentAction";
import { paymentActionService } from "@/lib/paymentActionService";

type Phase = "category" | "form" | "review" | "processing" | "success" | "failed";

const AVAILABLE_BALANCE = 185000;

interface PayBillDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (payment: PaymentAction) => void;
}

export function PayBillDrawer({ open, onOpenChange, onCompleted }: PayBillDrawerProps) {
  const [phase, setPhase] = useState<Phase>("category");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [biller, setBiller] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("2000");
  const [dueDate] = useState(() => new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10));
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [payment, setPayment] = useState<PaymentAction | null>(null);

  const category = BILL_CATEGORIES.find((c) => c.id === categoryId) ?? null;
  const amountNum = Number(amount) || 0;
  const amountError = amountNum > 0 && amountNum > AVAILABLE_BALANCE ? "Amount exceeds your available balance." : null;
  const canReview = biller != null && customerId.trim().length > 0 && amountNum > 0 && !amountError && (!scheduleLater || scheduleDate);

  const reset = () => {
    setPhase("category");
    setCategoryId(null);
    setBiller(null);
    setCustomerId("");
    setAmount("2000");
    setScheduleLater(false);
    setScheduleDate("");
    setPayment(null);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 250);
  };

  const methodLabel = "Primary Bank Account";

  const pay = async () => {
    if (!biller || !category) return;
    if (!scheduleLater) setPhase("processing");
    try {
      const result = await paymentActionService.createBillPayment({
        billerName: biller,
        category: category.label,
        customerId: customerId.trim(),
        amount: amountNum,
        paymentMethod: methodLabel,
        dueDate,
        scheduleDate: scheduleLater ? scheduleDate : null,
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
          <SheetTitle>Pay a Bill</SheetTitle>
          <SheetDescription>Pay your utility and service bills securely.</SheetDescription>
        </SheetHeader>

        {phase === "category" && (
          <div className="mt-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              {BILL_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategoryId(c.id); setBiller(null); setPhase("form"); }}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="text-xl">{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "form" && category && (
          <div className="mt-4 flex-1 space-y-6">
            <button onClick={() => setPhase("category")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> {category.label}
            </button>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Select Biller</p>
              <div className="space-y-1.5">
                {category.billers.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBiller(b)}
                    className={`w-full rounded-lg border p-3 text-left text-sm font-medium transition-colors ${
                      biller === b ? "border-primary bg-primary/5 text-foreground" : "border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Customer ID</p>
              <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="e.g. 98473291" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Bill amount</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
                <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-7 text-2xl font-bold h-14" />
              </div>
              <p className="text-xs text-muted-foreground">Due date {new Date(dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
              {amountError && <p className="text-xs font-medium text-red-600">{amountError}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Payment method</p>
              <label className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 p-3">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Primary Bank Account</p>
                  <p className="text-xs text-muted-foreground">Available balance: ₹{AVAILABLE_BALANCE.toLocaleString()}</p>
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Payment date</p>
              <RadioGroup value={scheduleLater ? "later" : "now"} onValueChange={(v) => setScheduleLater(v === "later")} className="space-y-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${!scheduleLater ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  <RadioGroupItem value="now" id="bill-date-now" />
                  <span className="text-sm font-medium text-foreground">Pay now</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${scheduleLater ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  <RadioGroupItem value="later" id="bill-date-later" />
                  <span className="text-sm font-medium text-foreground">Schedule for later</span>
                </label>
              </RadioGroup>
              {scheduleLater && (
                <Input type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setScheduleDate(e.target.value)} />
              )}
            </div>

          </div>
        )}

        {phase === "review" && category && biller && (
          <div className="mt-4 flex-1 space-y-4">
            <p className="text-sm font-semibold text-foreground">Review Bill Payment</p>
            <dl className="space-y-3 rounded-lg border border-border/60 p-4 text-sm">
              <Row label="Biller" value={biller} />
              <Row label="Customer ID" value={customerId} />
              <Row label="Amount" value={`₹${amountNum.toLocaleString()}`} />
              <Row label="Payment method" value={methodLabel} />
              <Row label="Due date" value={new Date(dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })} />
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
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <div>
              <p className="text-lg font-semibold text-foreground">{payment.status === "upcoming" ? "Bill Scheduled" : "Bill Paid Successfully"}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">₹{payment.amount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{payment.billerName}</p>
            </div>
            <dl className="w-full space-y-2 rounded-lg border border-border/60 p-4 text-left text-sm">
              <Row label="Customer ID" value={payment.customerId ?? ""} />
              {payment.transactionId && <Row label="Transaction ID" value={payment.transactionId} />}
              <Row
                label={payment.status === "upcoming" ? "Scheduled for" : "Paid on"}
                value={new Date(payment.paidAt ?? payment.dueDate ?? payment.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              />
            </dl>
            {payment.status === "paid" && <p className="text-xs font-medium text-green-700">✓ Receipt generated successfully</p>}
          </div>
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
            <Button className="w-full" disabled={!canReview} onClick={() => setPhase("review")}>Review Bill Payment</Button>
          )}
          {phase === "review" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("form")}>Back</Button>
              <Button className="flex-1" onClick={pay}>Pay ₹{amountNum.toLocaleString()}</Button>
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
