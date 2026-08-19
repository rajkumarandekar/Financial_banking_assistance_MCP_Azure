import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/chartTokens";
import type { MarketTrend } from "@/models/MarketTrend";

function MoverRow({ trend, positive }: { trend: MarketTrend; positive: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${positive ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"}`}>
          {trend.symbol.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{trend.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">{trend.name}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(trend.price)}</p>
        <p className={`text-xs font-medium ${positive ? "text-green-600" : "text-rose-600"}`}>
          {positive ? "+" : ""}{trend.changePercent.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

export function TopGainersCard({ gainers }: { gainers: MarketTrend[] }) {
  return (
    <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Top Gainers</h3>
        {gainers.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">No stocks up right now.</p>
        ) : (
          <div className="mt-1 divide-y divide-border/50">
            {gainers.map((t) => <MoverRow key={t.symbol} trend={t} positive />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TopLosersCard({ losers }: { losers: MarketTrend[] }) {
  return (
    <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Top Losers</h3>
        {losers.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">No stocks down right now.</p>
        ) : (
          <div className="mt-1 divide-y divide-border/50">
            {losers.map((t) => <MoverRow key={t.symbol} trend={t} positive={false} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
