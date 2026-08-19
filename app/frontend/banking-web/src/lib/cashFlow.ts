// Builds a fixed-width, zero-filled monthly income/expense series from the
// real transaction ledger - same pattern as computeBalanceHistory.
//
// The previous version grouped transactions into a Map and read whatever
// months happened to have activity, so if only 5 of the last 6 months had a
// transaction, the chart quietly rendered 5 unevenly-spaced points instead of
// 6 - and the "1 Year" toggle looked broken whenever the ledger didn't
// actually span 12 months, because there was nothing beyond 6 months to
// reveal. Always emitting exactly `monthsBack` consecutive months (with 0s
// where there's no activity) makes both problems disappear: the chart is
// always evenly spaced, and the range toggle always has real months to show.
export interface MonthFlow {
  month: string;
  /** "August 2026" - disambiguates same-named months across years in tooltips. */
  fullLabel: string;
  income: number;
  expenses: number;
}

interface TxLike {
  timestamp: string;
  amount: number;
  flowType?: string;
}

export function computeMonthlyCashFlow(transactions: TxLike[], monthsBack = 12): MonthFlow[] {
  const now = new Date();
  const buckets: MonthFlow[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: d.toLocaleString(undefined, { month: "short" }),
      fullLabel: d.toLocaleString(undefined, { month: "long", year: "numeric" }),
      income: 0,
      expenses: 0,
    });
  }

  for (const t of transactions) {
    const d = new Date(t.timestamp);
    const offset = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (offset < 0 || offset >= monthsBack) continue;
    const bucket = buckets[monthsBack - 1 - offset];
    if (t.flowType === "income") bucket.income += t.amount;
    else bucket.expenses += Math.abs(t.amount);
  }

  return buckets;
}

/** Sums a slice of monthly buckets into one range total - used when the
 * "6 Months / 1 Year" toggle should also change the summary figures, not
 * just the chart. */
export function sumCashFlow(range: MonthFlow[]): { income: number; expenses: number; net: number } {
  const income = range.reduce((s, m) => s + m.income, 0);
  const expenses = range.reduce((s, m) => s + m.expenses, 0);
  return { income, expenses, net: income - expenses };
}
