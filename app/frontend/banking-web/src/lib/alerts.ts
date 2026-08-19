// Smart Alerts - synthesized purely from real account/card/loan/credit data,
// no invented numbers. Shared between the Dashboard panel and the
// Navigation notification bell so both reflect the same computed state.
import { CreditCard as CreditCardModel } from "@/models/CreditCard";
import { AccountDetails } from "@/models/Account";
import { Loan, CreditScore } from "@/models/Domain";

export type AlertSeverity = "critical" | "warning" | "info";

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
}

export const LOW_BALANCE_THRESHOLD = 5000;
export const HIGH_UTILIZATION_THRESHOLD = 75;
export const EMI_DUE_SOON_DAYS = 7;
export const CARD_NEAR_LIMIT_THRESHOLD = 90;

export const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

interface ComputeAlertsInput {
  account: AccountDetails | null | undefined;
  cards: CreditCardModel[] | undefined;
  loans: Loan[] | undefined;
  creditScore: CreditScore | null | undefined;
}

export function computeSmartAlerts({ account, cards = [], loans = [], creditScore }: ComputeAlertsInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  const limitSum = cards.reduce((sum, c) => sum + (c.limit ?? 0), 0);
  const balanceSum = cards.reduce((sum, c) => sum + (c.balance ?? 0), 0);
  const utilizationRate = limitSum > 0 ? (balanceSum / limitSum) * 100 : 0;

  if (utilizationRate >= HIGH_UTILIZATION_THRESHOLD) {
    alerts.push({
      id: "utilization",
      severity: utilizationRate >= 90 ? "critical" : "warning",
      title: "High credit utilization",
      description: `You're using ${utilizationRate.toFixed(0)}% of your total credit limit. Consider paying down your balance to protect your credit score.`,
    });
  }

  for (const card of cards) {
    if (card.limit > 0 && (card.balance / card.limit) * 100 >= CARD_NEAR_LIMIT_THRESHOLD) {
      alerts.push({
        id: `card-${card.id}`,
        severity: "warning",
        title: `${card.name} is near its limit`,
        description: `₹${card.balance.toLocaleString()} of ₹${card.limit.toLocaleString()} used (${((card.balance / card.limit) * 100).toFixed(0)}%).`,
      });
    }
  }

  if (account && account.balance < LOW_BALANCE_THRESHOLD) {
    alerts.push({
      id: "low-balance",
      severity: "critical",
      title: "Low account balance",
      description: `Your balance is ₹${account.balance.toLocaleString()}, below the ₹${LOW_BALANCE_THRESHOLD.toLocaleString()} comfort threshold.`,
    });
  }

  const upcomingEmis = loans
    .flatMap((l) => (l.emiSchedule ?? []).map((emi) => ({ ...emi, loanType: l.loanType })))
    .filter((emi) => ["pending", "due", "upcoming"].includes((emi.status ?? "").toLowerCase()))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  for (const emi of upcomingEmis) {
    const daysUntilDue = Math.ceil((new Date(emi.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue >= 0 && daysUntilDue <= EMI_DUE_SOON_DAYS) {
      alerts.push({
        id: `emi-${emi.loanType}-${emi.installmentNumber}`,
        severity: daysUntilDue <= 2 ? "critical" : "warning",
        title: `EMI due ${daysUntilDue === 0 ? "today" : `in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`}`,
        description: `₹${emi.amount.toLocaleString()} for your ${emi.loanType} loan, installment #${emi.installmentNumber}.`,
      });
    }
  }

  if (creditScore && ["poor", "fair"].includes((creditScore.rating ?? "").toLowerCase())) {
    alerts.push({
      id: "credit-score",
      severity: "info",
      title: "Room to improve your credit score",
      description: `Your score is ${creditScore.score} (${creditScore.rating}). Paying on time and lowering utilization will help.`,
    });
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
