// Compact eligibility widget (gauge + headline) and the full Eligibility
// Checker form+result - both driven by lib/loanCenterService's scoring
// model, and both clearly labeled "estimated" since it's not underwriting.
import { useMemo, useState, type ReactNode } from "react";
import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { calculateEligibility, LOAN_TYPE_LABEL } from "@/lib/loanCenterService";
import type { LoanType, EligibilityFactor } from "@/models/LoanCenter";

function scoreColor(score: number) {
  if (score >= 70) return "#16a34a";
  if (score >= 45) return "#f59e0b";
  return "#dc2626";
}

export function LoanEligibilityWidget({ creditScore, totalMonthlyEmi, onCheckFull }: { creditScore: number; totalMonthlyEmi: number; onCheckFull: () => void }) {
  const result = useMemo(
    () => calculateEligibility({
      monthlyIncome: 75000, employmentType: "Salaried", existingMonthlyEmi: totalMonthlyEmi,
      desiredAmount: 500000, loanType: "personal", creditScore,
    }),
    [totalMonthlyEmi, creditScore]
  );
  const color = scoreColor(result.score);
  const data = [{ value: result.score, fill: color }];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50 h-full">
      <CardContent className="p-6 flex flex-col items-center text-center">
        <h3 className="self-start text-sm font-semibold text-foreground">Loan Eligibility</h3>
        <p className="self-start text-xs text-muted-foreground mb-2">Check how much you may qualify for</p>
        <div className="relative mt-2" style={{ width: 150, height: 150 }}>
          <RadialBarChart width={150} height={150} cx="50%" cy="50%" innerRadius="74%" outerRadius="100%" barSize={14} data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={8} isAnimationActive animationDuration={900} />
          </RadialBarChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{result.score}</p>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">You may qualify for up to</p>
        <p className="text-xl font-bold text-foreground tabular-nums">₹{result.maxEligibleAmount.toLocaleString()}</p>
        <Button size="sm" className="mt-4 w-full" onClick={onCheckFull}>Check Eligibility</Button>
        <p className="mt-2 text-[10px] text-muted-foreground">Estimated eligibility, not a final credit decision.</p>
      </CardContent>
    </Card>
  );
}

const LOAN_TYPES: LoanType[] = ["personal", "auto", "home", "education", "business"];

export function LoanEligibilityChecker({ creditScore }: { creditScore: number }) {
  const [income, setIncome] = useState("75000");
  const [employment, setEmployment] = useState("Salaried");
  const [existingEmi, setExistingEmi] = useState("12000");
  const [amount, setAmount] = useState("500000");
  const [loanType, setLoanType] = useState<LoanType>("personal");
  const [result, setResult] = useState<ReturnType<typeof calculateEligibility> | null>(null);

  const check = () => {
    setResult(calculateEligibility({
      monthlyIncome: Number(income) || 0,
      employmentType: employment,
      existingMonthlyEmi: Number(existingEmi) || 0,
      desiredAmount: Number(amount) || 0,
      loanType,
      creditScore,
    }));
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">Check Loan Eligibility</h3>
        <p className="text-sm text-muted-foreground">Find out how much you may qualify for.</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Monthly Income">
            <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
          </Field>
          <Field label="Employment Type">
            <Select value={employment} onValueChange={setEmployment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Salaried">Salaried</SelectItem>
                <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Existing Monthly EMIs">
            <Input type="number" value={existingEmi} onChange={(e) => setExistingEmi(e.target.value)} />
          </Field>
          <Field label="Desired Loan Amount">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Loan Type">
            <Select value={loanType} onValueChange={(v) => setLoanType(v as LoanType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOAN_TYPES.map((t) => <SelectItem key={t} value={t}>{LOAN_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Button className="mt-4" onClick={check}>Check Eligibility</Button>

        {result && (
          <div className="mt-6 border-t border-border/60 pt-5">
            <p className={`text-sm font-semibold ${result.eligible ? "text-green-700" : "text-red-600"}`}>
              {result.eligible ? "✓ Likely Eligible" : "Limited Eligibility"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">You may qualify for up to</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">₹{result.maxEligibleAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Estimated eligibility score {result.score} / 100</p>

            <div className="mt-4 space-y-2.5">
              {result.factors.map((f: EligibilityFactor) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-medium text-foreground">{f.level}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${f.score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-border/60 p-3 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Recommended loan amount</p>
                <p className="font-semibold text-foreground">₹{result.recommendedAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Estimated EMI</p>
                <p className="font-semibold text-foreground">₹{result.recommendedEmi.toLocaleString()}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Debt-to-income: {result.dti}% — {result.dti < 30 ? "Healthy. Your existing EMI burden is relatively low." : "Elevated — consider a smaller amount or longer tenure."}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">Estimated eligibility, not a final credit decision.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
