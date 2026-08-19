// Tracked symbols the customer doesn't currently hold - a real watchlist
// derived from the same price cache every other tab reads, not a separate
// fabricated list.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/chartTokens";
import type { MarketTrend } from "@/models/MarketTrend";

interface WatchlistTableProps {
  watchlist: MarketTrend[];
  onTrade: (symbol: string) => void;
}

export function WatchlistTable({ watchlist, onTrade }: WatchlistTableProps) {
  return (
    <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="text-foreground">Watchlist</CardTitle>
        <CardDescription>Tracked stocks you don't currently hold</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {watchlist.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">You hold every tracked stock already.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>% Change</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlist.map((t) => {
                const hasPrice = t.price > 0;
                return (
                  <TableRow key={t.symbol}>
                    <TableCell className="font-medium">{t.symbol}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{hasPrice ? formatINR(t.price) : <span className="text-xs text-muted-foreground">Pending refresh</span>}</TableCell>
                    <TableCell className={!hasPrice ? "text-muted-foreground" : t.change >= 0 ? "text-green-600" : "text-rose-600"}>
                      {hasPrice ? `${t.change >= 0 ? "+" : ""}${formatINR(t.change)}` : "—"}
                    </TableCell>
                    <TableCell className={!hasPrice ? "text-muted-foreground" : t.changePercent >= 0 ? "text-green-600" : "text-rose-600"}>
                      {hasPrice ? `${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(2)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={!hasPrice} onClick={() => onTrade(t.symbol)}>Buy</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
