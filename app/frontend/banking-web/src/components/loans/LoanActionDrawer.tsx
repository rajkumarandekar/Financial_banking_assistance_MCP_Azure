// One drawer, three actions - Pay EMI / Make Extra Payment / Apply for a
// Loan - since all three share the same review -> confirm -> processing ->
// success shape. All state changes go through loanCenterService; no real
// money moves, no AI Assistant involvement.
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { LoanAccount, LoanType } from "@/models/LoanCenter";
import { payEMI, makeExtraPayment, createApplication, calculateEMI, LOAN_TYPE_LABEL } from "@/lib/loanCenterService";

type Mode = "pay" | "extra" | "apply";
type Phase = "form" | "review" | "processing" | "success";

interface ApplyContext {
  type: LoanType;
  lenderName: string;
  amount: number;
  tenureMonths: number;
}

interface LoanActionDrawerProps {
  mode: Mode | null;
  loan?: LoanAccount | null;
  applyContext?: ApplyContext | null;
  onClose: () => void;
}

export function LoanActionDrawer({ mode, loan, applyContext, onClose }: LoanActionDrawerProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [extraAmount, setExtraAmount] = useState("25000");
  const [applicantName, setApplicantName] = useState("Bob User");
  const [applicantEmail, setApplicantEmail] = useState("bob.user@contoso.com");
  const [employmentType, setEmploymentType] = useState("Salaried");
  const [monthlyIncome, setMonthlyIncome] = useState("75000");
  const [result, setResult] = useState<{ outstanding?: number; interestSaved?: number; applicationId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = mode != null;

  const extraNum = Number(extraAmount) || 0;
  const projectedBalance = loan ? Math.max(loan.outstanding - Math.min(extraNum, loan.outstanding), 0) : 0;
  const estimatedInterestSaved = loan ? Math.round(Math.min(extraNum, loan.outstanding) * (loan.interestRateApr / 12 / 100) * loan.remainingMonths) : 0;

  const applyEmi = applyContext ? calculateEMI(applyContext.amount, 11, applyContext.tenureMonths) : 0;

  const close = () => {
    onClose();
    setTimeout(() => { setPhase("form"); setResult(null); setExtraAmount("25000"); setError(null); }, 250);
  };

  const confirm = async () => {
    setPhase("processing");
    setError(null);
    try {
      if (mode === "pay" && loan) {
        const updated = await payEMI(loan.id);
        setResult({ outstanding: updated?.outstanding });
      } else if (mode === "extra" && loan) {
        const r = await makeExtraPayment(loan, extraNum);
        setResult({ outstanding: r?.loan.outstanding, interestSaved: r?.interestSaved });
      } else if (mode === "apply" && applyContext) {
        const app = await createApplication({
          type: applyContext.type,
          lenderName: applyContext.lenderName,
          amount: applyContext.amount,
          tenureMonths: applyContext.tenureMonths,
          applicantName, applicantEmail, employmentType,
          monthlyIncome: Number(monthlyIncome) || 0,
        });
        setResult({ applicationId: app.id });
      }
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("form");
    }
  };

  const title = mode === "pay" ? "Pay EMI" : mode === "extra" ? "Make Extra Payment" : "Apply for a Loan";
  const subtitle = mode === "pay"
    ? "Pay this month's installment toward your loan."
    : mode === "extra"
      ? "Reduce your outstanding balance and save on interest."
      : "Complete your details to submit a loan application.";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="flex flex-col gap-0 bg-card sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{subtitle}</SheetDescription>
        </SheetHeader>

        {error && phase === "form" && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}

        {mode === "pay" && loan && phase === "form" && (
          <div className="mt-4 flex-1 space-y-4">
            <Row label="Loan" value={`${LOAN_TYPE_LABEL[loan.type]} · ${loan.lenderName}`} />
            <Row label="Outstanding" value={`₹${loan.outstanding.toLocaleString()}`} />
            <Row label="EMI amount" value={`₹${loan.emi.toLocaleString()}`} />
            <Row label="Payment method" value="Primary Bank Account" />
          </div>
        )}

        {mode === "extra" && loan && phase === "form" && (
          <div className="mt-4 flex-1 space-y-4">
            <Row label="Outstanding Balance" value={`₹${loan.outstanding.toLocaleString()}`} />
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Extra Payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input type="number" min="0" max={loan.outstanding} value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)} className="pl-7 text-lg font-semibold" />
              </div>
            </div>
            <Row label="New Estimated Balance" value={`₹${projectedBalance.toLocaleString()}`} />
            <Row label="Estimated interest saved" value={`₹${estimatedInterestSaved.toLocaleString()}`} />
          </div>
        )}

        {mode === "apply" && applyContext && phase === "form" && (
          <div className="mt-4 flex-1 space-y-5">
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Loan Details</p>
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <Row label="Loan type" value={LOAN_TYPE_LABEL[applyContext.type]} />
                <Row label="Lender" value={applyContext.lenderName} />
                <Row label="Amount" value={`₹${applyContext.amount.toLocaleString()}`} />
                <Row label="Tenure" value={`${applyContext.tenureMonths} months`} />
                <Row label="Estimated EMI" value={`₹${Math.round(applyEmi).toLocaleString()}`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Applicant Details</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full Name</Label>
                  <Input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Employment Type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Salaried">Salaried</SelectItem>
                      <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Monthly Income</Label>
                  <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="mt-4 flex-1 space-y-4">
            <p className="text-sm font-semibold text-foreground">{mode === "extra" ? "Review Extra Payment" : "Review Application"}</p>
            {mode === "apply" && applyContext && (
              <dl className="space-y-3 rounded-lg border border-border/60 p-4 text-sm">
                <Row label="Loan type" value={LOAN_TYPE_LABEL[applyContext.type]} />
                <Row label="Amount" value={`₹${applyContext.amount.toLocaleString()}`} />
                <Row label="Applicant" value={applicantName} />
                <Row label="Monthly income" value={`₹${Number(monthlyIncome).toLocaleString()}`} />
              </dl>
            )}
            {mode === "extra" && loan && (
              <dl className="space-y-3 rounded-lg border border-border/60 p-4 text-sm">
                <Row label="Extra payment" value={`₹${extraNum.toLocaleString()}`} />
                <Row label="New estimated balance" value={`₹${projectedBalance.toLocaleString()}`} />
                <Row label="Estimated interest saved" value={`₹${estimatedInterestSaved.toLocaleString()}`} />
              </dl>
            )}
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing your request...</p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            {mode === "pay" && (
              <div>
                <p className="text-lg font-semibold text-foreground">Payment Successful</p>
                <p className="text-sm text-muted-foreground mt-1">New outstanding: ₹{result?.outstanding?.toLocaleString()}</p>
              </div>
            )}
            {mode === "extra" && (
              <div>
                <p className="text-lg font-semibold text-foreground">Extra Payment Applied</p>
                <p className="text-sm text-muted-foreground mt-1">New outstanding: ₹{result?.outstanding?.toLocaleString()}</p>
                <p className="text-sm text-green-700 mt-1">Estimated interest saved: ₹{result?.interestSaved?.toLocaleString()}</p>
              </div>
            )}
            {mode === "apply" && (
              <div>
                <p className="text-lg font-semibold text-foreground">Application Submitted</p>
                <p className="text-sm text-muted-foreground mt-1">Application ID</p>
                <p className="text-sm font-semibold text-foreground">{result?.applicationId}</p>
                <p className="text-xs text-muted-foreground mt-2">Status: Under Review</p>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          {phase === "form" && (mode === "apply" || mode === "extra") && (
            <Button className="w-full" onClick={() => setPhase("review")}>
              {mode === "apply" ? "Review Application" : "Review"}
            </Button>
          )}
          {phase === "form" && mode === "pay" && (
            <Button className="w-full" onClick={confirm}>Confirm & Pay ₹{loan?.emi.toLocaleString()}</Button>
          )}
          {phase === "review" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("form")}>Back</Button>
              <Button className="flex-1" onClick={confirm}>
                {mode === "apply" ? "Submit Application" : "Confirm Payment"}
              </Button>
            </div>
          )}
          {phase === "success" && (
            <Button className="w-full" onClick={close}>Done</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
