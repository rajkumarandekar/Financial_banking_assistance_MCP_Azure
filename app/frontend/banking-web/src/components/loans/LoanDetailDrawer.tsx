// Loan detail drawer: full numbers, next-5 EMI schedule, mock documents,
// and the entry points into Pay EMI / Extra Payment / Statement.
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Eye } from "lucide-react";
import type { LoanAccount } from "@/models/LoanCenter";
import { generateSchedule, LOAN_TYPE_LABEL } from "@/lib/loanCenterService";

const STATUS_BADGE: Record<string, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
};

const DOCS = ["Loan Agreement", "EMI Schedule", "Repayment Statement", "Interest Certificate"];

interface LoanDetailDrawerProps {
  loan: LoanAccount | null;
  onClose: () => void;
  onPayEmi: (loan: LoanAccount) => void;
  onExtraPayment: (loan: LoanAccount) => void;
}

export function LoanDetailDrawer({ loan, onClose, onPayEmi, onExtraPayment }: LoanDetailDrawerProps) {
  const [showDocs, setShowDocs] = useState(false);

  if (!loan) {
    return <Sheet open={false} onOpenChange={() => onClose()}><SheetContent /></Sheet>;
  }

  const repaidPct = ((loan.principal - loan.outstanding) / loan.principal) * 100;
  const schedule = generateSchedule(loan, 5);

  return (
    <Sheet open={loan != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-card sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{LOAN_TYPE_LABEL[loan.type]}</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{loan.lenderName}</p>
          <Badge variant="outline" className={STATUS_BADGE[loan.status]}>● {loan.status[0].toUpperCase() + loan.status.slice(1)}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <Stat label="Original Amount" value={`₹${loan.principal.toLocaleString()}`} />
          <Stat label="Outstanding" value={`₹${loan.outstanding.toLocaleString()}`} />
          <Stat label="Interest Rate" value={`${loan.interestRateApr}%`} />
          <Stat label="Monthly EMI" value={`₹${loan.emi.toLocaleString()}`} />
          <Stat label="Remaining Tenure" value={`${loan.remainingMonths} months`} />
          <Stat label="Next Due" value={new Date(loan.nextDueDate).toLocaleDateString(undefined, { dateStyle: "medium" })} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Repayment Progress</span>
            <span>{repaidPct.toFixed(1)}% repaid</span>
          </div>
          <Progress value={repaidPct} className="mt-1.5 h-2" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Principal Paid ₹{loan.principalPaid.toLocaleString()}</span>
            <span>Interest Paid ₹{loan.interestPaid.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onPayEmi(loan)}>Pay EMI</Button>
          <Button size="sm" variant="outline" onClick={() => onExtraPayment(loan)}>Make Extra Payment</Button>
          <Button size="sm" variant="outline" onClick={() => setShowDocs((s) => !s)}>
            <FileText className="mr-1.5 h-3.5 w-3.5" />View Documents
          </Button>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">EMI Schedule</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">EMI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((row) => (
                <TableRow key={row.installmentNumber}>
                  <TableCell>{row.installmentNumber}</TableCell>
                  <TableCell>{new Date(row.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })}</TableCell>
                  <TableCell className="text-right">₹{row.principal.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{row.interest.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{row.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {showDocs && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">Documents</h3>
            <div className="divide-y divide-border/50 rounded-lg border border-border/60">
              {DOCS.map((doc) => (
                <div key={doc} className="flex items-center justify-between p-3">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />{doc}.pdf
                  </span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Eye className="mr-1 h-3 w-3" />View</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Download className="mr-1 h-3 w-3" />Download</Button>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Sample content for illustration only.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
