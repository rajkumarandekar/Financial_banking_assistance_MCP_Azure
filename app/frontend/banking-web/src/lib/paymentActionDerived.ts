// Summary totals for the "Your Payment Activity" KPI row, computed from the
// one shared payments store. (Transaction-shaped mirroring used to live here
// too, back when paid payments were local-only state - now that "pay now"
// executes for real, the resulting transaction already exists in
// transaction-service, so there's nothing left to mirror.)
import type { PaymentAction } from "@/models/PaymentAction";

export interface PaymentActionSummary {
  paidTotal: number;
  paidCount: number;
  upcomingTotal: number;
  upcomingCount: number;
  failedTotal: number;
  failedCount: number;
}

export function computePaymentActionSummary(payments: PaymentAction[]): PaymentActionSummary {
  const summary: PaymentActionSummary = {
    paidTotal: 0, paidCount: 0,
    upcomingTotal: 0, upcomingCount: 0,
    failedTotal: 0, failedCount: 0,
  };
  for (const p of payments) {
    if (p.status === "paid") {
      summary.paidTotal += p.amount;
      summary.paidCount += 1;
    } else if (p.status === "upcoming") {
      summary.upcomingTotal += p.amount;
      summary.upcomingCount += 1;
    } else if (p.status === "failed") {
      summary.failedTotal += p.amount;
      summary.failedCount += 1;
    }
  }
  return summary;
}
