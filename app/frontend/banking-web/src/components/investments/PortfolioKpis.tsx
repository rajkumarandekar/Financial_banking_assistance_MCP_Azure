import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, IndianRupee, Wallet, Trophy } from "lucide-react";
import { formatINR } from "@/lib/chartTokens";
import type { PortfolioSummary } from "@/lib/investmentAnalytics";
import type { Stock } from "@/models/Stock";

interface PortfolioKpisProps {
  summary: PortfolioSummary;
  best: { stock: Stock; gainLoss: number; gainLossPct: number } | null;
}

export function PortfolioKpis({ summary, best }: PortfolioKpisProps) {
  const { portfolioValue, investedAmount, totalGainLoss, totalGainLossPct, todaysGainLoss, todaysGainLossPct } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <IndianRupee className="h-3.5 w-3.5" />Portfolio Value
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{formatINR(portfolioValue)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total Market Value</p>
        </CardContent>
      </Card>

      <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {totalGainLoss >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}Total Gain / Loss
          </p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${totalGainLoss >= 0 ? "text-green-600" : "text-rose-600"}`}>
            {totalGainLoss >= 0 ? "+" : "-"}{formatINR(Math.abs(totalGainLoss))}
          </p>
          <p className={`mt-0.5 text-xs font-medium ${totalGainLoss >= 0 ? "text-green-600" : "text-rose-600"}`}>
            {totalGainLossPct >= 0 ? "+" : ""}{totalGainLossPct.toFixed(2)}% (All Time)
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {todaysGainLoss >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}Today's Gain / Loss
          </p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${todaysGainLoss >= 0 ? "text-green-600" : "text-rose-600"}`}>
            {todaysGainLoss >= 0 ? "+" : "-"}{formatINR(Math.abs(todaysGainLoss))}
          </p>
          <p className={`mt-0.5 text-xs font-medium ${todaysGainLoss >= 0 ? "text-green-600" : "text-rose-600"}`}>
            {todaysGainLossPct >= 0 ? "+" : ""}{todaysGainLossPct.toFixed(2)}%
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />Invested Amount
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{formatINR(investedAmount)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total Invested</p>
        </CardContent>
      </Card>

      <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />Best Performer
          </p>
          {best ? (
            <>
              <p className="mt-1.5 text-2xl font-bold text-foreground">{best.stock.symbol}</p>
              <p className="mt-0.5 text-xs font-medium text-green-600">
                +{formatINR(best.gainLoss)} (+{best.gainLossPct.toFixed(2)}%)
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">No holdings yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
