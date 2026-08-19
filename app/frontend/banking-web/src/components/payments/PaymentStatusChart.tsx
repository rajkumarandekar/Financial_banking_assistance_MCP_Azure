// "How are my payments distributed by status?" - a donut over the real
// payment-service records (paid/pending/failed), plus real upcoming EMI
// instalments folded in as a fourth "Upcoming" slice so the chart matches
// what the KPI row promises. Colour is status, not identity, so it's drawn
// from STATUS in chartTokens rather than the categorical palette.
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS, formatINR } from "@/lib/chartTokens";

interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

interface PaymentStatusChartProps {
  paidCount: number;
  pendingCount: number;
  upcomingCount: number;
  failedCount: number;
  paidAmount: number;
  pendingAmount: number;
}

function SliceTooltip({ active, payload, total }: {
  active?: boolean;
  payload?: { payload: StatusSlice }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
        {p.name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{p.value} payments · {pct}%</p>
    </div>
  );
}

export function PaymentStatusChart({
  paidCount, pendingCount, upcomingCount, failedCount, paidAmount, pendingAmount,
}: PaymentStatusChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const slices: StatusSlice[] = [
    { name: "Paid", value: paidCount, color: STATUS.excellent },
    { name: "Pending", value: pendingCount, color: STATUS.warning },
    { name: "Upcoming", value: upcomingCount, color: STATUS.info },
    { name: "Failed", value: failedCount, color: STATUS.critical },
  ].filter((s) => s.value > 0);

  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-5">
        <h3 className="text-sm font-semibold text-foreground">Payment Status</h3>

        {total === 0 ? (
          <p className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
            No payment activity yet.
          </p>
        ) : (
          <div className="mt-2 flex flex-1 flex-col items-center gap-4 sm:flex-row">
            <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices} cx="50%" cy="50%" innerRadius={52} outerRadius={76}
                    paddingAngle={2} dataKey="value" nameKey="name"
                    onMouseEnter={(e: { name?: string }) => setHovered(e.name ?? null)}
                    onMouseLeave={() => setHovered(null)}
                    isAnimationActive animationDuration={700}
                  >
                    {slices.map((s) => (
                      <Cell key={s.name} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2}
                        opacity={hovered && hovered !== s.name ? 0.4 : 1}
                        style={{ transition: "opacity 0.2s ease" }} />
                    ))}
                  </Pie>
                  <Tooltip content={<SliceTooltip total={total} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold tabular-nums text-foreground">{total}</p>
                <p className="text-[11px] text-muted-foreground">Total</p>
              </div>
            </div>

            <div className="w-full flex-1 space-y-1.5">
              {slices.map((s) => {
                const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                return (
                  <div key={s.name}
                    onMouseEnter={() => setHovered(s.name)}
                    onMouseLeave={() => setHovered(null)}
                    className="flex items-center justify-between rounded-lg px-2 py-1 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-foreground">{s.name}</span>
                    </span>
                    <span className="text-muted-foreground">{s.value} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
          <span className="text-muted-foreground">Total paid <span className="font-semibold text-foreground">{formatINR(paidAmount)}</span></span>
          <span className="text-muted-foreground">Total pending <span className="font-semibold text-foreground">{formatINR(pendingAmount)}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
