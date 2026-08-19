// Payments domain: status rules and derived aggregates, kept separate from
// any component so the page stays "render a view model" rather than
// "compute one inline".
//
// WHAT IS REAL AND WHAT IS NOT
// -----------------------------
// payment-service (db/models.py) stores exactly: id, description,
// recipientName, paymentType, amount, cardId, category, status
// (processing|paid|pending|failed|cancelled), created_at/updated_at. There is
// no due date, no biller/invoice-number field, no recurring-bill concept, and
// no "upcoming" status - "Upcoming" only exists in this app for loan EMI
// instalments, which DO have a real due date. So:
//   - Pending / Paid / Failed figures below are 100% real, from payment-service.
//   - "Upcoming" is sourced from real loan EMI data (see UpcomingPaymentsPanel),
//     never fabricated bill due-dates.
//   - "Monthly budget" has no backing field either; it's computed as the real
//     trailing average of paid amounts, not an invented constant.
import type { Payment } from "@/models/Payments";

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

/** processing + pending both read as "not settled yet" to the user. */
export function normalizeStatus(raw: string | null | undefined): PaymentStatus {
  const v = (raw ?? "").toLowerCase();
  if (v === "paid") return "paid";
  if (v === "failed") return "failed";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return "pending"; // processing | pending | anything unrecognized
}

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** "Gas supply invoice 173645AB435" -> billed name minus the trailing reference,
 * so the table can show a clean payment name with the reference as a subline
 * without a dedicated invoice-number field on the backend. */
export function splitDescription(description: string): { name: string; reference: string | null } {
  const match = description.match(/^(.*?)\s+([A-Za-z]*\d{4,}[A-Za-z0-9]*)$/);
  if (match) return { name: match[1].trim(), reference: match[2] };
  return { name: description, reference: null };
}

export function monthKey(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, { month: "short", year: "2-digit" });
}

export interface PaymentTotals {
  // All-time - these are what the status donut and the table's filter-tab
  // counts both read, so the two can never disagree (rule: charts, KPIs and
  // the table must share one source of truth).
  pendingAmount: number;
  pendingCount: number;
  paidAmount: number;
  paidCount: number;
  failedAmount: number;
  failedCount: number;
  cancelledCount: number;
  // Scoped to the current calendar month specifically - only the "Paid This
  // Month" KPI card uses these, since that's the one figure whose label
  // makes a month-scoped promise.
  paidThisMonthAmount: number;
  paidThisMonthCount: number;
}

const isThisMonth = (timestamp: string) => {
  const d = new Date(timestamp);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export function computeTotals(payments: Payment[]): PaymentTotals {
  const totals: PaymentTotals = {
    pendingAmount: 0, pendingCount: 0,
    paidAmount: 0, paidCount: 0,
    failedAmount: 0, failedCount: 0,
    cancelledCount: 0,
    paidThisMonthAmount: 0, paidThisMonthCount: 0,
  };
  for (const p of payments) {
    const status = normalizeStatus(p.status);
    if (status === "pending") {
      totals.pendingAmount += p.amount;
      totals.pendingCount += 1;
    } else if (status === "paid") {
      totals.paidAmount += p.amount;
      totals.paidCount += 1;
      if (isThisMonth(p.timestamp)) {
        totals.paidThisMonthAmount += p.amount;
        totals.paidThisMonthCount += 1;
      }
    } else if (status === "failed") {
      totals.failedAmount += p.amount;
      totals.failedCount += 1;
    } else if (status === "cancelled") {
      totals.cancelledCount += 1;
    }
  }
  return totals;
}

/** Real trailing average of monthly paid totals - stands in for "budget"
 * since payment-service has no budget field. */
export function computeAverageMonthlyPaid(payments: Payment[], monthsBack = 3): number {
  const now = new Date();
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    if (normalizeStatus(p.status) !== "paid") continue;
    const d = new Date(p.timestamp);
    const offset = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (offset < 0 || offset >= monthsBack) continue;
    const key = monthKey(p.timestamp);
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.amount);
  }
  if (byMonth.size === 0) return 0;
  return Array.from(byMonth.values()).reduce((s, v) => s + v, 0) / byMonth.size;
}

export interface DailyPaymentPoint {
  day: string;
  date: Date;
  paid: number;
  pending: number;
}

/** Day-by-day paid vs pending amounts for the current month, zero-filled up
 * to today (not the whole month) so the trend line doesn't dive to zero for
 * days that haven't happened yet. */
export function computeMonthlyTrend(payments: Payment[]): DailyPaymentPoint[] {
  const now = new Date();
  const daysSoFar = now.getDate();
  const points: DailyPaymentPoint[] = [];
  for (let day = 1; day <= daysSoFar; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    points.push({ day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), date, paid: 0, pending: 0 });
  }
  for (const p of payments) {
    const d = new Date(p.timestamp);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    const point = points[d.getDate() - 1];
    if (!point) continue;
    const status = normalizeStatus(p.status);
    if (status === "paid") point.paid += p.amount;
    else if (status === "pending") point.pending += p.amount;
  }
  return points;
}
