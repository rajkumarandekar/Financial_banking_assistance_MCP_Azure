// Loans & Lending Center. Per-loan numbers, the marketplace (explore/offers/
// eligibility/calculators), and applications all run through
// lib/loanCenterService.ts - this is a lending command center, not a single
// EMI table. Real credit score is reused (not modified) for eligibility.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCreditScore } from "@/hooks/useBankingData";
import { useLoanAccounts } from "@/lib/loanCenterService";
import { LoanOverviewKpis } from "@/components/loans/LoanOverviewKpis";
import { MyActiveLoans } from "@/components/loans/MyActiveLoans";
import { UpcomingLoanPayments } from "@/components/loans/UpcomingLoanPayments";
import { LoanEligibilityWidget, LoanEligibilityChecker } from "@/components/loans/LoanEligibility";
import { LoanCalculators } from "@/components/loans/LoanCalculators";
import { LoanApplications } from "@/components/loans/LoanApplications";
import { LoanDetailDrawer } from "@/components/loans/LoanDetailDrawer";
import { LoanActionDrawer } from "@/components/loans/LoanActionDrawer";
import type { LoanAccount } from "@/models/LoanCenter";

export default function Loans() {
  const loans = useLoanAccounts();
  const { data: creditScore } = useCreditScore();

  const [detailLoan, setDetailLoan] = useState<LoanAccount | null>(null);
  const [actionMode, setActionMode] = useState<"pay" | "extra" | "apply" | null>(null);
  const [actionLoan, setActionLoan] = useState<LoanAccount | null>(null);

  const totalMonthlyEmi = loans.filter((l) => l.status === "active").reduce((s, l) => s + l.emi, 0);

  const openPay = (loan: LoanAccount) => { setActionLoan(loan); setActionMode("pay"); };
  const openExtra = (loan: LoanAccount) => { setActionLoan(loan); setActionMode("extra"); };
  const closeAction = () => { setActionMode(null); setActionLoan(null); };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Loans</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your loans, explore offers and plan your repayments.</p>
        </div>
        <Button onClick={() => { setActionLoan(null); setActionMode("apply"); }}>
          <Plus className="mr-2 h-4 w-4" />Apply for a Loan
        </Button>
      </div>

      <LoanOverviewKpis loans={loans} />

      <MyActiveLoans loans={loans} onViewDetails={setDetailLoan} onPayEmi={openPay} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingLoanPayments loans={loans} onPayEmi={openPay} />
        </div>
        <LoanEligibilityWidget
          creditScore={creditScore?.score ?? 690}
          totalMonthlyEmi={totalMonthlyEmi}
          onCheckFull={() => document.getElementById("eligibility-checker")?.scrollIntoView({ behavior: "smooth" })}
        />
      </div>

      <LoanCalculators />

      <div id="eligibility-checker">
        <LoanEligibilityChecker creditScore={creditScore?.score ?? 690} />
      </div>

      <LoanApplications />

      <LoanDetailDrawer
        loan={detailLoan}
        onClose={() => setDetailLoan(null)}
        onPayEmi={(l) => { setDetailLoan(null); openPay(l); }}
        onExtraPayment={(l) => { setDetailLoan(null); openExtra(l); }}
      />

      <LoanActionDrawer
        mode={actionMode}
        loan={actionLoan}
        applyContext={actionMode === "apply" ? { type: "personal", lenderName: "SecureBank", amount: 500000, tenureMonths: 36 } : null}
        onClose={closeAction}
      />
    </div>
  );
}
