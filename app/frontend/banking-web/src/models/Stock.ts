export interface Stock {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  purchasePrice: number;
  // Date this position was first opened - never moves on later buys.
  firstPurchaseDate?: string;
  // Date of the most recent buy into this symbol - advances every time more
  // shares are bought (avgPurchasePrice blends across all buys, this date
  // tracks only the latest one).
  latestPurchaseDate?: string;
  sector: string;
}
