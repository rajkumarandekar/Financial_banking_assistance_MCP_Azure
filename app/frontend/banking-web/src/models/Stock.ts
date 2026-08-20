export interface Stock {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  purchasePrice: number;
  // Date of the *first* buy that created this holding. If more shares were
  // bought later, avgPurchasePrice blends across all of them, but this date
  // doesn't move - it's "when I started this position", not "every buy".
  purchaseDate?: string;
  sector: string;
}
