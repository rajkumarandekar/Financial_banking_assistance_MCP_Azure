export interface Stock {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  purchasePrice: number;
  // A holding's average cost can span several buys over time now that
  // trades are real - there's no single "purchase date" to show anymore.
  purchaseDate?: string;
  sector: string;
}
