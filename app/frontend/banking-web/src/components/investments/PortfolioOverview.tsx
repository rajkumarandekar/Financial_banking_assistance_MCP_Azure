// Holdings Distribution donut - grouped by sector (real, stored per holding),
// not market-cap tier (Large Cap / Mid Cap in the reference design) since
// nothing in this system classifies stocks by market cap.
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/chartTokens";
import type { SectorSlice } from "@/lib/investmentAnalytics";

// Explicit custom tooltip (only renders when actively hovered) instead of
// recharts' default - the default tooltip has no "name" field configured
// for this data shape and was rendering as "<array index>: <value>"
// (e.g. "2 : ₹52,320") sitting on top of the center total-value label.
function SectorTooltip({ active, payload }: { active?: boolean; payload?: { payload: SectorSlice }[] }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />{slice.sector}
      </p>
      <p className="mt-0.5 text-muted-foreground">{formatINR(slice.value)} · {slice.percentage.toFixed(1)}%</p>
    </div>
  );
}

export function PortfolioOverview({ sectors, totalValue }: { sectors: SectorSlice[]; totalValue: number }) {
  return (
    <Card className="min-w-0 bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Portfolio Overview</h3>
            <p className="text-xs text-muted-foreground">Holdings distribution by sector</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-muted-foreground">Total Value</p>
            <p className="text-sm font-bold tabular-nums text-foreground">{formatINR(totalValue)}</p>
          </div>
        </div>

        {sectors.length === 0 ? (
          <p className="mt-6 py-6 text-center text-sm text-muted-foreground">No holdings yet.</p>
        ) : (
          <div className="mt-4 flex items-center gap-5">
            <div className="shrink-0" style={{ width: 150, height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectors} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value" nameKey="sector">
                    {sectors.map((s) => <Cell key={s.sector} fill={s.color} stroke="white" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip content={<SectorTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              {sectors.map((s) => (
                <div key={s.sector} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="truncate">{s.sector}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-foreground">{formatINR(s.value)} · {s.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
