// Derives a month-end balance series from the account's current balance and
// its real transaction ledger - there is no historical-balance endpoint, so
// we walk the actual transactions backward from "now" (amount is signed by
// flowType) to reconstruct what the balance was at each prior month
// boundary. Every point is arithmetic on real data, not an invented curve.
export interface BalancePoint {
  month: string;
  date: Date;
  balance: number;
}

interface TxLike {
  timestamp: string;
  amount: number;
  flowType?: string;
}

export function computeBalanceHistory(
  currentBalance: number,
  transactions: TxLike[],
  monthsBack = 6
): BalancePoint[] {
  const now = new Date();
  const boundaries: { key: string; end: Date }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = i === 0 ? now : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
    boundaries.push({ key: monthStart.toLocaleString(undefined, { month: "short" }), end });
  }

  const sorted = [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return boundaries.map(({ key, end }) => {
    let delta = 0;
    for (const t of sorted) {
      const ts = new Date(t.timestamp);
      if (ts <= end) continue;
      delta += t.flowType === "income" ? t.amount : -t.amount;
    }
    return { month: key, date: end, balance: Math.round(currentBalance - delta) };
  });
}
