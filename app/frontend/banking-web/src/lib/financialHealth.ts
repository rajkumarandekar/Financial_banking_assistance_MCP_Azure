// Composite "financial health" score, in the same spirit as computeCustomerTier
// and computeSmartAlerts: a genuine business rule applied to real account/card/
// loan/transaction data, not a fabricated number. Each sub-metric is derived
// from data the app already fetches.
export type HealthLevel = "Excellent" | "Good" | "Fair" | "Needs attention";

export interface HealthMetric {
  label: string;
  level: HealthLevel;
  score: number; // 0-100, used only to blend into the overall score
}

export interface FinancialHealth {
  overall: number; // 0-100
  status: "Healthy" | "Fair" | "Needs attention";
  metrics: HealthMetric[];
}

const levelFromScore = (score: number): HealthLevel => {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 40) return "Fair";
  return "Needs attention";
};

interface EmiLike {
  status?: string | null;
  dueDate: string;
}

interface MonthFlow {
  income: number;
  expenses: number;
}

export function computeFinancialHealth(input: {
  utilizationRate: number; // 0-100
  loans: { emiSchedule?: EmiLike[] | null }[];
  cashFlow: MonthFlow[]; // chronological, oldest -> newest
  balanceHistory: number[]; // chronological, oldest -> newest
}): FinancialHealth {
  const { utilizationRate, loans, cashFlow, balanceHistory } = input;

  // Credit utilization: mirrors the same 30% / 50% thresholds shown on the ring.
  const utilizationScore = utilizationRate < 30 ? 95 : utilizationRate < 50 ? 65 : 30;

  // Payment history: fraction of past-due EMI installments actually paid on time.
  const allInstallments = loans.flatMap((l) => l.emiSchedule ?? []);
  const pastDue = allInstallments.filter((emi) => new Date(emi.dueDate) <= new Date());
  const missed = pastDue.filter((emi) => ["missed", "late", "overdue"].includes((emi.status ?? "").toLowerCase()));
  const paymentScore = pastDue.length === 0 ? 90 : Math.round(((pastDue.length - missed.length) / pastDue.length) * 100);

  // Spending: is the most recent month's spend trending down vs. the one before it?
  const lastTwo = cashFlow.slice(-2);
  let spendingScore = 70;
  if (lastTwo.length === 2 && lastTwo[0].expenses > 0) {
    const change = (lastTwo[1].expenses - lastTwo[0].expenses) / lastTwo[0].expenses;
    spendingScore = change <= -0.05 ? 90 : change <= 0.05 ? 70 : change <= 0.2 ? 50 : 30;
  }

  // Savings: is the account balance trending up over the observed window?
  let savingsScore = 70;
  if (balanceHistory.length >= 2) {
    const first = balanceHistory[0];
    const last = balanceHistory[balanceHistory.length - 1];
    if (first > 0) {
      const change = (last - first) / first;
      savingsScore = change >= 0.05 ? 90 : change >= -0.02 ? 70 : 40;
    }
  }

  const metrics: HealthMetric[] = [
    { label: "Credit utilization", level: levelFromScore(utilizationScore), score: utilizationScore },
    { label: "Payment history", level: levelFromScore(paymentScore), score: paymentScore },
    { label: "Spending", level: levelFromScore(spendingScore), score: spendingScore },
    { label: "Savings", level: levelFromScore(savingsScore), score: savingsScore },
  ];

  const overall = Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length);
  const status = overall >= 70 ? "Healthy" : overall >= 45 ? "Fair" : "Needs attention";

  return { overall, status, metrics };
}
