import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LOAN_TYPE_LABEL } from "@/lib/loanCenterService";
import type { LoanAccount, LoanType } from "@/models/LoanCenter";

const TABS: { id: LoanType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "personal", label: "Personal" },
  { id: "auto", label: "Car" },
  { id: "home", label: "Home" },
];

const STATUS_BADGE: Record<string, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
};

interface MyActiveLoansProps {
  loans: LoanAccount[];
  onViewDetails: (loan: LoanAccount) => void;
  onPayEmi: (loan: LoanAccount) => void;
}

export function MyActiveLoans({ loans, onViewDetails, onPayEmi }: MyActiveLoansProps) {
  const [tab, setTab] = useState<LoanType | "all">("all");
  const visible = tab === "all" ? loans : loans.filter((l) => l.type === tab);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">My Loans</h2>
          <p className="text-xs text-muted-foreground">{loans.length} Active Loans</p>
        </div>
        <div className="flex rounded-lg border border-border/60 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {visible.map((loan) => {
          const repaidPct = ((loan.principal - loan.outstanding) / loan.principal) * 100;
          return (
            <Card key={loan.id} className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{LOAN_TYPE_LABEL[loan.type]}</p>
                  <Badge variant="outline" className={STATUS_BADGE[loan.status]}>● {loan.status[0].toUpperCase() + loan.status.slice(1)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{loan.lenderName}</p>

                <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Original amount</p>
                    <p className="font-medium text-foreground">₹{loan.principal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Outstanding</p>
                    <p className="font-medium text-foreground">₹{loan.outstanding.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Monthly EMI</p>
                    <p className="font-medium text-foreground">₹{loan.emi.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Interest</p>
                    <p className="font-medium text-foreground">{loan.interestRateApr}%</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Repayment Progress</span>
                    <span>{repaidPct.toFixed(1)}% repaid</span>
                  </div>
                  <Progress value={repaidPct} className="mt-1 h-1.5" />
                </div>

                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => onViewDetails(loan)}>View Details</Button>
                  <Button size="sm" className="flex-1" onClick={() => onPayEmi(loan)}>Pay EMI</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground py-6 text-center">No loans in this category.</p>
        )}
      </div>
    </div>
  );
}
