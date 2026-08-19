// Centralized calculations for the Transaction Analytics page. Everything
// downstream (KPIs, charts, category breakdown, insights) reads from these
// functions instead of computing its own aggregates inline, so the numbers
// shown across the page can never drift from each other.
import type { Payment } from "@/models/Payments";

export type RangeKey = "7d" | "30d" | "90d" | "6m" | "1y";

export const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365,
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  "6m": "6 Months",
  "1y": "1 Year",
};

// Matches the real category strings transaction-service returns (same map
// used on Dashboard/Credit Cards) - an invented category list would never
// match real data and every category would fall back to "Other".
export const CATEGORY_COLORS: Record<string, string> = {
  Utilities: "#3b82f6", Supplies: "#f59e0b", Software: "#10b981", Subscriptions: "#8b5cf6",
  Meals: "#ec4899", Insurance: "#06b6d4", Retail: "#f97316", Health: "#14b8a6",
  Rent: "#a855f7", Payroll: "#22c55e", Investment: "#eab308", Education: "#f43f5e",
};
export const DEFAULT_CATEGORY_COLOR = "#94a3b8";

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
}

/** Distinct categories actually present in the ledger, alphabetized - the
 * category filter dropdown is built from this, never a hardcoded guess. */
export function distinctCategories(transactions: Payment[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) set.add(t.category || "Other");
  return Array.from(set).sort();
}

export function filterByRange(transactions: Payment[], range: RangeKey): Payment[] {
  const cutoff = Date.now() - RANGE_DAYS[range] * 86_400_000;
  return transactions.filter((t) => new Date(t.timestamp).getTime() >= cutoff);
}

export function filterByCategory(transactions: Payment[], category: string): Payment[] {
  if (category === "all") return transactions;
  return transactions.filter((t) => (t.category || "Other") === category);
}

/** "primary" = the account's own transactions (no card attached).
 * Any other value is a card id - transactions charged to that card. */
export function filterByAccount(transactions: Payment[], account: string): Payment[] {
  if (account === "all") return transactions;
  if (account === "primary") return transactions.filter((t) => !t.cardId);
  return transactions.filter((t) => t.cardId === account);
}

export interface Totals {
  income: number;
  expenses: number;
  net: number;
  avg: number;
  count: number;
  incomeCount: number;
  expenseCount: number;
}

export function calculateTotals(transactions: Payment[]): Totals {
  let income = 0;
  let expenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const t of transactions) {
    if (t.flowType === "income") { income += t.amount; incomeCount += 1; }
    else { expenses += t.amount; expenseCount += 1; }
  }
  const count = transactions.length;
  const avg = count > 0 ? (income + expenses) / count : 0;
  return { income, expenses, net: income - expenses, avg, count, incomeCount, expenseCount };
}

/** % change from `prev` to `curr`. Null when there's no prior-period figure
 * to compare against (never divide by zero to fabricate a percentage). */
export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/** Totals for the selected range, and for the equal-length window
 * immediately before it - the basis for every "vs previous period" figure. */
export function calculatePreviousPeriodComparison(
  categoryAccountFiltered: Payment[],
  range: RangeKey
): { current: Totals; previous: Totals } {
  const days = RANGE_DAYS[range];
  const now = Date.now();
  const currentStart = now - days * 86_400_000;
  const previousStart = now - days * 2 * 86_400_000;

  const current = categoryAccountFiltered.filter((t) => new Date(t.timestamp).getTime() >= currentStart);
  const previous = categoryAccountFiltered.filter((t) => {
    const ts = new Date(t.timestamp).getTime();
    return ts >= previousStart && ts < currentStart;
  });

  return { current: calculateTotals(current), previous: calculateTotals(previous) };
}

export interface CategoryRow {
  category: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

/** Expense-only breakdown, sorted by spend descending - the order is always
 * derived, never manually maintained. */
export function calculateCategoryBreakdown(transactions: Payment[]): CategoryRow[] {
  const byCategory = new Map<string, { amount: number; count: number }>();
  for (const t of transactions) {
    if (t.flowType === "income") continue;
    const key = t.category || "Other";
    const bucket = byCategory.get(key) ?? { amount: 0, count: 0 };
    bucket.amount += t.amount;
    bucket.count += 1;
    byCategory.set(key, bucket);
  }
  const total = Array.from(byCategory.values()).reduce((s, b) => s + b.amount, 0);
  return Array.from(byCategory.entries())
    .map(([category, b]) => ({
      category,
      amount: b.amount,
      count: b.count,
      percentage: total > 0 ? Math.round((b.amount / total) * 100) : 0,
      color: categoryColor(category),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function calculateTopCategory(breakdown: CategoryRow[]): CategoryRow | null {
  return breakdown[0] ?? null;
}

export function calculateLargestTransaction(transactions: Payment[]): Payment | null {
  const spend = transactions.filter((t) => t.flowType !== "income");
  if (spend.length === 0) return null;
  return spend.reduce((max, t) => (t.amount > max.amount ? t : max), spend[0]);
}

/** Expense transactions charged to any credit card (cardId set) - lets the
 * page surface "credit card spending" without duplicating Credit Card
 * Management's own balance/statement math. */
export function calculateCreditCardSpending(transactions: Payment[]): number {
  return transactions
    .filter((t) => t.flowType !== "income" && t.cardId)
    .reduce((s, t) => s + t.amount, 0);
}

export interface TrendPoint {
  label: string;
  income: number;
  expenses: number;
}

function bucketGranularity(range: RangeKey): "day" | "week" | "month" {
  if (range === "7d" || range === "30d") return "day";
  if (range === "90d" || range === "6m") return "week";
  return "month";
}

/** Zero-filled trend series across the full selected window, at a
 * granularity that keeps the point count readable (daily for short ranges,
 * weekly for medium, monthly for long ones). Zero-filling - not fabricating
 * extra transactions - is what keeps the chart from looking "empty": every
 * day/week/month in range gets a point, even ones with no activity. */
export function calculateSpendingTrend(transactions: Payment[], range: RangeKey): TrendPoint[] {
  const granularity = bucketGranularity(range);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (granularity === "day") {
    const days = RANGE_DAYS[range];
    const buckets: TrendPoint[] = Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), income: 0, expenses: 0 };
    });
    for (const t of transactions) {
      const d = new Date(t.timestamp);
      d.setHours(0, 0, 0, 0);
      const offset = Math.round((now.getTime() - d.getTime()) / 86_400_000);
      const idx = days - 1 - offset;
      if (idx < 0 || idx >= days) continue;
      if (t.flowType === "income") buckets[idx].income += t.amount;
      else buckets[idx].expenses += t.amount;
    }
    return buckets;
  }

  if (granularity === "week") {
    const weeks = Math.ceil(RANGE_DAYS[range] / 7);
    const buckets: TrendPoint[] = Array.from({ length: weeks }, (_, i) => {
      const start = new Date(now);
      start.setDate(start.getDate() - (weeks - 1 - i) * 7 - 6);
      return { label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), income: 0, expenses: 0 };
    });
    for (const t of transactions) {
      const ts = new Date(t.timestamp).getTime();
      const offsetDays = Math.floor((now.getTime() - ts) / 86_400_000);
      if (offsetDays < 0 || offsetDays >= weeks * 7) continue;
      const idx = weeks - 1 - Math.floor(offsetDays / 7);
      if (idx < 0 || idx >= weeks) continue;
      if (t.flowType === "income") buckets[idx].income += t.amount;
      else buckets[idx].expenses += t.amount;
    }
    return buckets;
  }

  const months = range === "1y" ? 12 : 6;
  const buckets: TrendPoint[] = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { label: d.toLocaleString(undefined, { month: "short" }), income: 0, expenses: 0 };
  });
  for (const t of transactions) {
    const d = new Date(t.timestamp);
    const offset = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    const idx = months - 1 - offset;
    if (idx < 0 || idx >= months) continue;
    if (t.flowType === "income") buckets[idx].income += t.amount;
    else buckets[idx].expenses += t.amount;
  }
  return buckets;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Real file download (Blob + object URL, not a print dialog) of the
 * currently-filtered transaction list. */
export function downloadTransactionsCsv(transactions: Payment[], rangeLabel: string) {
  const header = ["Date", "Merchant", "Category", "Type", "Amount", "Status"];
  const rows = transactions.map((t) => [
    new Date(t.timestamp).toLocaleDateString("en-IN"),
    t.description || t.recipientName || "Transaction",
    t.category || "Other",
    t.flowType === "income" ? "Income" : "Expense",
    t.amount.toFixed(2),
    t.status || "completed",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SecureBank-Transactions-${rangeLabel.replace(/\s+/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
