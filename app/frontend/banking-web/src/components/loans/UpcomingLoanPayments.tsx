import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LOAN_TYPE_LABEL } from "@/lib/loanCenterService";
import type { LoanAccount } from "@/models/LoanCenter";

export function UpcomingLoanPayments({ loans, onPayEmi }: { loans: LoanAccount[]; onPayEmi: (loan: LoanAccount) => void }) {
  const upcoming = [...loans]
    .filter((l) => l.status === "active")
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  const total = upcoming.reduce((s, l) => s + l.emi, 0);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Upcoming EMI Payments</h3>
        <div className="mt-3 space-y-2">
          {upcoming.map((loan) => (
            <div key={loan.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">{new Date(loan.nextDueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                <p className="text-sm font-medium text-foreground">{LOAN_TYPE_LABEL[loan.type]}</p>
                <p className="text-xs text-muted-foreground">{loan.lenderName}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-foreground">₹{loan.emi.toLocaleString()}</p>
                <Button size="sm" variant="outline" onClick={() => onPayEmi(loan)}>Pay EMI</Button>
              </div>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No upcoming EMIs.</p>}
        </div>
        {upcoming.length > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-sm">
            <span className="text-muted-foreground">Total due this month</span>
            <span className="font-semibold text-foreground">₹{total.toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
