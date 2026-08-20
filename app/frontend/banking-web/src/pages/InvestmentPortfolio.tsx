// Investments. Holdings, market watchlist and trade history are all real
// investment-service data (a real 9th microservice) - prices come from
// Alpha Vantage's official remote MCP server, refreshed server-side and
// cached, never fetched live per-request. Buy/Sell in the Trade dialog
// execute for real against the server's cached price. Every figure on this
// page (KPIs, sector split, movers, ticker) is derived from that same real
// data via lib/investmentAnalytics.ts - nothing here is invented, and pieces
// this system has no real data source for (market indices, market-cap tier,
// historical performance chart) are simply left out rather than faked.
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Plus, Minus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/chartTokens";
import {
  computePortfolioSummary, computeSectorBreakdown,
  bestPerformer, getTopGainers, getTopLosers, getWatchlist,
} from "@/lib/investmentAnalytics";
import { buyStock, refreshPrices, sellStock, useHoldings, useInvestmentTransactions, useMarketTrends } from "@/lib/investmentService";
import { MarketStatusBadge } from "@/components/investments/MarketStatusBadge";
import { PortfolioKpis } from "@/components/investments/PortfolioKpis";
import { PortfolioOverview } from "@/components/investments/PortfolioOverview";
import { TopGainersCard, TopLosersCard } from "@/components/investments/TopMovers";
import { WatchlistTable } from "@/components/investments/WatchlistTable";
import { LiveMarketTicker } from "@/components/investments/LiveMarketTicker";

function getStockGainLoss(stock: { shares: number; currentPrice: number; purchasePrice: number }): number {
  return stock.shares * stock.currentPrice - stock.shares * stock.purchasePrice;
}
function getStockGainLossPercent(stock: { currentPrice: number; purchasePrice: number }): number {
  return stock.purchasePrice > 0 ? ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100 : 0;
}

export default function InvestmentPortfolio() {
  const { toast } = useToast();
  const portfolio = useHoldings();
  const transactions = useInvestmentTransactions();
  const marketTrends = useMarketTrends();

  const [selectedStock, setSelectedStock] = useState("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [isTradeDialogOpen, setIsTradeDialogOpen] = useState(false);
  const [trading, setTrading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const summary = useMemo(() => computePortfolioSummary(portfolio, marketTrends), [portfolio, marketTrends]);
  const best = useMemo(() => bestPerformer(portfolio), [portfolio]);
  const sectors = useMemo(() => computeSectorBreakdown(portfolio), [portfolio]);
  const gainers = useMemo(() => getTopGainers(marketTrends), [marketTrends]);
  const losers = useMemo(() => getTopLosers(marketTrends), [marketTrends]);
  const watchlist = useMemo(() => getWatchlist(marketTrends, portfolio), [marketTrends, portfolio]);

  const tradableSymbols = tradeType === "sell"
    ? portfolio.map((s) => s.symbol)
    : marketTrends.map((m) => m.symbol);

  const resetTradeForm = () => { setSelectedStock(""); setShares(""); };

  const openTradeFor = (symbol: string) => {
    setTradeType("buy");
    setSelectedStock(symbol);
    setIsTradeDialogOpen(true);
  };

  const handleTrade = async () => {
    const shareCount = parseInt(shares, 10) || 0;
    if (!selectedStock || shareCount <= 0) return;
    setTrading(true);
    try {
      if (tradeType === "buy") {
        await buyStock(selectedStock, shareCount);
        toast({ title: "✓ Trade executed", description: `Bought ${shareCount} shares of ${selectedStock}.` });
      } else {
        await sellStock(selectedStock, shareCount);
        toast({ title: "✓ Trade executed", description: `Sold ${shareCount} shares of ${selectedStock}.` });
      }
      setIsTradeDialogOpen(false);
      resetTradeForm();
    } catch (err) {
      toast({ title: "Trade failed", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setTrading(false);
    }
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      const updated = await refreshPrices();
      toast({ title: "✓ Prices refreshed", description: `${updated} symbol${updated === 1 ? "" : "s"} updated.` });
    } catch (err) {
      toast({ title: "Couldn't refresh prices", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setRefreshing(false);
    }
  };

  const previewTrend = marketTrends.find((m) => m.symbol === selectedStock);
  const previewPrice = previewTrend?.price ?? 0;
  const previewShareCount = parseInt(shares, 10) || 0;
  const previewHolding = portfolio.find((s) => s.symbol === selectedStock);
  const priceUnavailable = selectedStock !== "" && !previewTrend?.price;

  return (
    <div className="mx-auto w-full max-w-[1600px] animate-fade-in space-y-6 overflow-x-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            Investments
            <Badge variant="outline" className="border-green-200 bg-green-50 text-[10px] font-semibold text-green-700">● Live</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track your portfolio, market trends, and invest in real-time.</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <MarketStatusBadge />
          <Button variant="outline" size="icon" onClick={handleRefreshPrices} disabled={refreshing} title="Refresh prices">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isTradeDialogOpen} onOpenChange={(open) => { setIsTradeDialogOpen(open); if (!open) resetTradeForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Activity className="mr-2 h-4 w-4" />Trade / Buy
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Trade Stocks</DialogTitle>
                <DialogDescription>Buy or sell stocks in your portfolio. Executes immediately.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Trade Type</Label>
                  <Select value={tradeType} onValueChange={(v: "buy" | "sell") => { setTradeType(v); setSelectedStock(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Stock Symbol</Label>
                  <Select value={selectedStock} onValueChange={setSelectedStock}>
                    <SelectTrigger><SelectValue placeholder="Select a stock" /></SelectTrigger>
                    <SelectContent>
                      {tradableSymbols.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No holdings to sell</div>
                      ) : (
                        tradableSymbols.map((sym) => {
                          const trend = marketTrends.find((m) => m.symbol === sym);
                          return <SelectItem key={sym} value={sym}>{sym} - {trend?.name ?? sym}</SelectItem>;
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="shares" className="text-xs">Number of Shares</Label>
                  <Input id="shares" type="number" min="1" placeholder="0" value={shares} onChange={(e) => setShares(e.target.value)} />
                  {priceUnavailable && (
                    <p className="text-xs text-amber-600">Price not available yet for {selectedStock} - try Refresh Prices.</p>
                  )}
                  {tradeType === "sell" && previewHolding && (
                    <p className="text-xs text-muted-foreground">You own {previewHolding.shares} shares</p>
                  )}
                </div>
                {selectedStock && shares && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <h4 className="mb-2 text-sm font-medium text-foreground">Trade Summary</h4>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Stock</span><span className="text-foreground">{selectedStock} - {formatINR(previewPrice)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Shares</span><span className="text-foreground">{previewShareCount}</span>
                      </div>
                      <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold text-foreground">
                        <span>Total</span><span>{formatINR(previewShareCount * previewPrice)}</span>
                      </div>
                      {tradeType === "sell" && previewHolding && previewShareCount > previewHolding.shares && (
                        <p className="text-xs text-rose-600">Warning: you only own {previewHolding.shares} shares</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={handleTrade}
                disabled={
                  trading || !selectedStock || !shares || previewShareCount <= 0 || priceUnavailable ||
                  (tradeType === "sell" && !!previewHolding && previewShareCount > previewHolding.shares)
                }
                className="w-full"
              >
                {trading ? "Processing..." : `${tradeType === "buy" ? "Buy" : "Sell"} Stocks`}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <PortfolioKpis summary={summary} best={best} />

      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portfolio">My Portfolio</TabsTrigger>
          <TabsTrigger value="market">Market Trends</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-6">
          {/* items-start is load-bearing: grid items stretch to equal height
              by default, which would pull the shorter cards down to match
              whichever one is tallest. Gainers/Losers sit side by side
              (not stacked) so neither one alone forces the row much taller
              than Portfolio Overview. */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-4">
            <div className="lg:col-span-2 xl:col-span-2">
              <PortfolioOverview sectors={sectors} totalValue={summary.portfolioValue} />
            </div>
            <TopGainersCard gainers={gainers} />
            <TopLosersCard losers={losers} />
          </div>

          <LiveMarketTicker trends={marketTrends} />

          <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Stock Holdings</CardTitle>
              <CardDescription>Your current stock positions and performance</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {portfolio.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">You don't hold any stocks yet. Use Trade / Buy to buy your first position.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Avg. Price</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>Market Value</TableHead>
                      <TableHead>Gain/Loss</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Sector</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.map((stock) => {
                      const gainLoss = getStockGainLoss(stock);
                      const gainLossPct = getStockGainLossPercent(stock);
                      const marketValue = stock.shares * stock.currentPrice;
                      const hasPrice = stock.currentPrice > 0;
                      return (
                        <TableRow key={stock.id}>
                          <TableCell className="font-medium">{stock.symbol}</TableCell>
                          <TableCell>{stock.name}</TableCell>
                          <TableCell>{stock.shares}</TableCell>
                          <TableCell>{formatINR(stock.purchasePrice)}</TableCell>
                          <TableCell>{hasPrice ? formatINR(stock.currentPrice) : <span className="text-xs text-muted-foreground">Pending refresh</span>}</TableCell>
                          <TableCell>{hasPrice ? formatINR(marketValue) : "—"}</TableCell>
                          <TableCell className={!hasPrice ? "text-muted-foreground" : gainLoss >= 0 ? "text-green-600" : "text-rose-600"}>
                            {hasPrice ? `${gainLoss >= 0 ? "+" : "-"}${formatINR(Math.abs(gainLoss))}` : "—"}
                          </TableCell>
                          <TableCell className={!hasPrice ? "text-muted-foreground" : gainLossPct >= 0 ? "text-green-600" : "text-rose-600"}>
                            {hasPrice ? `${gainLossPct >= 0 ? "+" : ""}${gainLossPct.toFixed(2)}%` : "—"}
                          </TableCell>
                          <TableCell><Badge variant="outline">{stock.sector}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market">
          <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Market Trends</CardTitle>
              <CardDescription>Current market performance and trends</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>% Change</TableHead>
                    <TableHead>Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketTrends.map((trend) => {
                    const hasPrice = trend.price > 0;
                    return (
                    <TableRow key={trend.symbol}>
                      <TableCell className="font-medium">{trend.symbol}</TableCell>
                      <TableCell>{trend.name}</TableCell>
                      <TableCell>{hasPrice ? formatINR(trend.price) : <span className="text-xs text-muted-foreground">Pending refresh</span>}</TableCell>
                      <TableCell className={!hasPrice ? "text-muted-foreground" : trend.change >= 0 ? "text-green-600" : "text-rose-600"}>
                        {hasPrice ? `${trend.change >= 0 ? "+" : "-"}${formatINR(Math.abs(trend.change))}` : "—"}
                      </TableCell>
                      <TableCell className={!hasPrice ? "text-muted-foreground" : trend.changePercent >= 0 ? "text-green-600" : "text-rose-600"}>
                        {hasPrice ? `${trend.changePercent >= 0 ? "+" : ""}${trend.changePercent.toFixed(2)}%` : "—"}
                      </TableCell>
                      <TableCell>{trend.volume > 0 ? trend.volume.toLocaleString("en-IN") : "—"}</TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist">
          <WatchlistTable watchlist={watchlist} onTrade={openTradeFor} />
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Recent Transactions</CardTitle>
              <CardDescription>Your latest buy and sell transactions</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {transactions.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">No trades yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{new Date(t.date).toLocaleDateString(undefined, { dateStyle: "medium" })}</TableCell>
                        <TableCell>
                          <Badge
                            variant={t.type === "buy" ? "default" : "secondary"}
                            className={t.type === "buy" ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-rose-100 text-rose-800 hover:bg-rose-100"}
                          >
                            {t.type === "buy" ? <Plus className="mr-1 h-3 w-3" /> : <Minus className="mr-1 h-3 w-3" />}
                            {t.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{t.symbol}</TableCell>
                        <TableCell>{t.shares}</TableCell>
                        <TableCell>{formatINR(t.price)}</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(t.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
