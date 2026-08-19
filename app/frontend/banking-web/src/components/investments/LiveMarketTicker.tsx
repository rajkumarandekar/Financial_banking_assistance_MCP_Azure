import { Circle } from "lucide-react";
import { formatINR } from "@/lib/chartTokens";
import type { MarketTrend } from "@/models/MarketTrend";

export function LiveMarketTicker({ trends }: { trends: MarketTrend[] }) {
  const priced = trends.filter((t) => t.price > 0);
  if (priced.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-border/50 bg-card/50 px-4 py-2.5 backdrop-blur">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Circle className="h-2 w-2 fill-green-500 text-green-500" />Live Market Ticker
      </span>
      <span className="h-4 w-px shrink-0 bg-border" />
      <div className="flex shrink-0 gap-6">
        {priced.map((t) => (
          <span key={t.symbol} className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-xs">
            <span className="font-semibold text-foreground">{t.symbol}</span>
            <span className="tabular-nums text-foreground">{formatINR(t.price)}</span>
            <span className={`tabular-nums font-medium ${t.change >= 0 ? "text-green-600" : "text-rose-600"}`}>
              {t.change >= 0 ? "+" : ""}{formatINR(t.change)} ({t.changePercent.toFixed(2)}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
