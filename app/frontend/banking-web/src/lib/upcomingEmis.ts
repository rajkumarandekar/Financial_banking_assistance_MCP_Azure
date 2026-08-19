// Shared "what's coming due" derivation - used by both the Dashboard's
// Upcoming Payments card and the Payments page. Loan EMI instalments are the
// only forward-looking obligation with a real due date anywhere in this app
// (see lib/payments.ts for why bill payments can't offer the same).
import type { Loan } from "@/models/Domain";

export interface UpcomingEmi {
  key: string;
  label: string;
  amount: number;
  dueDate: string;
}

export function computeUpcomingEmis(loans: Loan[], limit = 4): UpcomingEmi[] {
  return loans
    .flatMap((l) => (l.emiSchedule ?? []).map((emi) => ({ ...emi, loanType: l.loanType })))
    .filter((emi) => ["pending", "due", "upcoming"].includes((emi.status ?? "").toLowerCase()))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, limit)
    .map((emi) => ({
      key: `${emi.loanType}-${emi.installmentNumber}`,
      label: `${emi.loanType} EMI · #${emi.installmentNumber}`,
      amount: emi.amount,
      dueDate: emi.dueDate,
    }));
}
