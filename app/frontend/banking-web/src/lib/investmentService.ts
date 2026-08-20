// Investment Portfolio service. Holdings, trades, and market prices are all
// real investment-service data now (Postgres, via GraphQL - a real 9th
// microservice, matching the loan/payment/credit convention since it never
// had REST). Prices come from Alpha Vantage's official remote MCP server
// (https://mcp.alphavantage.co/mcp), refreshed server-side on a timer and
// cached - the frontend never calls Alpha Vantage directly, and buy/sell
// always uses the server's cached price, never a client-supplied one.
import { useMemo } from "react";
import { bffClient } from "@/api/bffClient";
import { queryClient } from "@/lib/queryClient";
import { useHoldings as useHoldingsQuery, useStockPrices as useStockPricesQuery, useStockTransactions } from "@/hooks/useBankingData";
import type { Stock } from "@/models/Stock";
import type { MarketTrend } from "@/models/MarketTrend";
import type { Transaction } from "@/models/Transaction";

function invalidateInvestments() {
  queryClient.invalidateQueries({ queryKey: ["holdings"] });
  queryClient.invalidateQueries({ queryKey: ["stockTransactions"] });
}

export function useHoldings(): Stock[] {
  const { data = [] } = useHoldingsQuery();
  return useMemo(
    () => data.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      name: h.companyName,
      shares: h.shares,
      currentPrice: h.currentPrice ?? 0,
      purchasePrice: h.avgPurchasePrice,
      purchaseDate: h.purchasedAt ?? undefined,
      sector: h.sector ?? "Other",
    })),
    [data]
  );
}

export function useMarketTrends(): MarketTrend[] {
  const { data = [] } = useStockPricesQuery();
  return useMemo(
    () => data.map((p) => ({
      symbol: p.symbol,
      name: p.companyName ?? p.symbol,
      price: p.price ?? 0,
      change: p.change ?? 0,
      changePercent: p.changePercent ?? 0,
      volume: p.volume ?? 0,
    })),
    [data]
  );
}

export function useInvestmentTransactions(): Transaction[] {
  const { data = [] } = useStockTransactions();
  return useMemo(
    () => data.map((t) => ({
      id: t.id, type: t.type, symbol: t.symbol, shares: t.shares, price: t.price, date: t.executedAt, total: t.total,
    })),
    [data]
  );
}

function toTransaction(t: { id: string; symbol: string; type: string; shares: number; price: number; total: number; executedAt: string }): Transaction {
  return { id: t.id, type: t.type as "buy" | "sell", symbol: t.symbol, shares: t.shares, price: t.price, date: t.executedAt, total: t.total };
}

/** Buys shares at the server's current cached price - fails with a clear
 * error if that symbol hasn't been priced yet (no fabricated fallback price). */
export async function buyStock(symbol: string, shares: number): Promise<Transaction> {
  // No companyName passed - the server resolves it from the price cache for
  // any tracked symbol (the only kind buyable from this UI right now).
  const result = await bffClient.buyStock({ symbol, shares });
  invalidateInvestments();
  return toTransaction(result);
}

export async function sellStock(symbol: string, shares: number): Promise<Transaction> {
  const result = await bffClient.sellStock(symbol, shares);
  invalidateInvestments();
  return toTransaction(result);
}

/** On-demand refresh on top of the automatic server-side timer - still
 * bounded by Alpha Vantage's free-tier rate limit either way. */
export async function refreshPrices(): Promise<number> {
  const updated = await bffClient.refreshStockPrices();
  queryClient.invalidateQueries({ queryKey: ["stockPrices"] });
  queryClient.invalidateQueries({ queryKey: ["holdings"] });
  return updated;
}
