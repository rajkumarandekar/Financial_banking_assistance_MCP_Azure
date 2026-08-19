// Centralized calculations for the Investments dashboard. Everything here is
// derived from real holdings + real cached market prices (investmentService.ts) -
// no invented sparklines, no fabricated index values. Where the reference
// design calls for data this system genuinely doesn't have (market-cap tier,
// index quotes, intraday history), the nearest real substitute is used
// instead (sector, in place of market-cap tier) rather than a fake number.
import type { Stock } from "@/models/Stock";
import type { MarketTrend } from "@/models/MarketTrend";

export interface PortfolioSummary {
  portfolioValue: number;
  investedAmount: number;
  totalGainLoss: number;
  totalGainLossPct: number;
  todaysGainLoss: number;
  todaysGainLossPct: number;
}

/** Today's gain/loss is real: Alpha Vantage's GLOBAL_QUOTE returns each
 * symbol's change vs the previous close, so summing shares*change across
 * holdings is a genuine day-over-day figure, not an estimate. */
export function computePortfolioSummary(holdings: Stock[], trends: MarketTrend[]): PortfolioSummary {
  const trendBySymbol = new Map(trends.map((t) => [t.symbol, t]));
  let portfolioValue = 0;
  let investedAmount = 0;
  let todaysGainLoss = 0;

  for (const h of holdings) {
    portfolioValue += h.shares * h.currentPrice;
    investedAmount += h.shares * h.purchasePrice;
    const trend = trendBySymbol.get(h.symbol);
    if (trend) todaysGainLoss += h.shares * trend.change;
  }

  const totalGainLoss = portfolioValue - investedAmount;
  const totalGainLossPct = investedAmount > 0 ? (totalGainLoss / investedAmount) * 100 : 0;
  const priorPortfolioValue = portfolioValue - todaysGainLoss;
  const todaysGainLossPct = priorPortfolioValue > 0 ? (todaysGainLoss / priorPortfolioValue) * 100 : 0;

  return { portfolioValue, investedAmount, totalGainLoss, totalGainLossPct, todaysGainLoss, todaysGainLossPct };
}

export function bestPerformer(holdings: Stock[]): { stock: Stock; gainLoss: number; gainLossPct: number } | null {
  if (holdings.length === 0) return null;
  const withPct = holdings.map((s) => ({
    stock: s,
    gainLoss: s.shares * (s.currentPrice - s.purchasePrice),
    gainLossPct: s.purchasePrice > 0 ? ((s.currentPrice - s.purchasePrice) / s.purchasePrice) * 100 : 0,
  }));
  return withPct.reduce((best, cur) => (cur.gainLossPct > best.gainLossPct ? cur : best));
}

export interface SectorSlice {
  sector: string;
  value: number;
  percentage: number;
  color: string;
}

const SECTOR_COLORS: Record<string, string> = {
  Technology: "#a855f7", Banking: "#2563eb", Energy: "#f59e0b", Telecom: "#14b8a6",
  Automotive: "#ec4899", Consumer: "#22c55e",
};
const DEFAULT_SECTOR_COLOR = "#94a3b8";

/** Grouped by sector (real, stored per holding) - not market-cap tier
 * (Large Cap / Mid Cap), which nothing in this system classifies. */
export function computeSectorBreakdown(holdings: Stock[]): SectorSlice[] {
  const bySector = new Map<string, number>();
  for (const h of holdings) {
    const value = h.shares * h.currentPrice;
    bySector.set(h.sector, (bySector.get(h.sector) ?? 0) + value);
  }
  const total = Array.from(bySector.values()).reduce((s, v) => s + v, 0);
  return Array.from(bySector.entries())
    .map(([sector, value]) => ({
      sector, value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      color: SECTOR_COLORS[sector] ?? DEFAULT_SECTOR_COLOR,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Only genuinely-up stocks - padding the list with the "least down" ones
 * when fewer than `limit` are actually positive would mislabel a real loss
 * as a gain (a real bug this had: a -0.07% stock showing as "+-0.07%"
 * because the list length was fixed regardless of sign). */
export function getTopGainers(trends: MarketTrend[], limit = 4): MarketTrend[] {
  return [...trends].filter((t) => t.price > 0 && t.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, limit);
}

export function getTopLosers(trends: MarketTrend[], limit = 4): MarketTrend[] {
  return [...trends].filter((t) => t.price > 0 && t.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, limit);
}

/** Tracked symbols the customer doesn't currently hold - a real watchlist
 * derived from the same price cache, not a separate fabricated list. */
export function getWatchlist(trends: MarketTrend[], holdings: Stock[]): MarketTrend[] {
  const held = new Set(holdings.map((h) => h.symbol));
  return trends.filter((t) => !held.has(t.symbol));
}

export interface MarketStatus {
  isOpen: boolean;
  label: string;
  countdownMs: number;
  countdownLabel: string;
}

const IST_OFFSET_MIN = 330; // UTC+5:30
const MARKET_OPEN_MIN = 9 * 60 + 15; // 09:15 IST
const MARKET_CLOSE_MIN = 15 * 60 + 30; // 15:30 IST

function toIST(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  return new Date(utcMs + IST_OFFSET_MIN * 60_000);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Real NSE/BSE trading hours (09:15-15:30 IST, Mon-Fri) - computed from
 * the actual clock, not a static badge. Doesn't account for market
 * holidays (no holiday calendar wired in), so it can be wrong on a trading
 * holiday - a real, disclosed limitation, not a silent one. */
export function computeMarketStatus(now: Date = new Date()): MarketStatus {
  const ist = toIST(now);
  const day = ist.getDay(); // 0 Sun ... 6 Sat
  const minutesOfDay = ist.getHours() * 60 + ist.getMinutes();
  const secondsOfMinute = ist.getSeconds();
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && minutesOfDay >= MARKET_OPEN_MIN && minutesOfDay < MARKET_CLOSE_MIN;

  if (isOpen) {
    const msToClose = (MARKET_CLOSE_MIN - minutesOfDay) * 60_000 - secondsOfMinute * 1000;
    return { isOpen: true, label: "Market Open", countdownMs: msToClose, countdownLabel: `Closes in ${formatCountdown(msToClose)}` };
  }

  // Find the next open: today if before 09:15 on a weekday, else the next weekday.
  let daysAhead = 0;
  if (isWeekday && minutesOfDay < MARKET_OPEN_MIN) {
    daysAhead = 0;
  } else {
    daysAhead = 1;
    let nextDay = (day + 1) % 7;
    while (nextDay === 0 || nextDay === 6) {
      daysAhead += 1;
      nextDay = (nextDay + 1) % 7;
    }
  }
  const nextOpen = new Date(ist);
  nextOpen.setDate(nextOpen.getDate() + daysAhead);
  nextOpen.setHours(9, 15, 0, 0);
  const msToOpen = nextOpen.getTime() - ist.getTime();
  return { isOpen: false, label: "Market Closed", countdownMs: msToOpen, countdownLabel: `Opens in ${formatCountdown(msToOpen)}` };
}
