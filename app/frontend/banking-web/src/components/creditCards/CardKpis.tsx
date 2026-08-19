import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { utilizationLevel, minimumPayment, nextDueDate, computeCardTotals } from "@/lib/creditCardService";
import type { CreditCard } from "@/models/CreditCard";

export function CardKpis({ cards }: { cards: (CreditCard & { frozen: boolean })[] }) {
  const { totalLimit, totalOutstanding, availableCredit: available, utilizationPct: utilization, activeCount } =
    computeCardTotals(cards);
  const level = utilizationLevel(utilization);
  const activeCards = cards.filter((c) => c.status === "active");
  const paymentDue = activeCards.reduce((s, c) => s + minimumPayment(c.balance), 0);
  const daysUntilDue = Math.ceil((new Date(nextDueDate()).getTime() - Date.now()) / 86400000);

  const items = [
    { label: "Total Outstanding", value: `₹${totalOutstanding.toLocaleString()}`, sub: `Across ${activeCount} active cards` },
    { label: "Available Credit", value: `₹${available.toLocaleString()}`, sub: `of ₹${totalLimit.toLocaleString()} total limit` },
    { label: "Credit Utilization", value: `${utilization.toFixed(1)}%`, sub: level.label, subColor: level.color },
    { label: "Payment Due", value: `₹${paymentDue.toLocaleString()}`, sub: paymentDue > 0 ? `Due in ${daysUntilDue} days` : "Nothing due" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="min-w-0 bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{it.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{it.value}</p>
            <p className="mt-0.5 text-[11px] font-medium" style={{ color: it.subColor ?? "hsl(var(--muted-foreground))" }}>{it.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function healthScoreColor(score: number) {
  if (score >= 70) return "#16a34a";
  if (score >= 45) return "#f59e0b";
  return "#dc2626";
}

export function CreditHealthSummary({ cards }: { cards: (CreditCard & { frozen: boolean })[] }) {
  const { totalLimit, totalOutstanding, availableCredit: available, utilizationPct: utilization } =
    computeCardTotals(cards);
  const level = utilizationLevel(utilization);
  const activeCards = cards.filter((c) => c.status === "active");
  const paymentDue = activeCards.reduce((s, c) => s + minimumPayment(c.balance), 0);

  // Payment history has no real missed-payment tracking for cards yet, so it's
  // treated as a constant until that data exists - utilization is the real,
  // data-driven half of this blended score.
  const utilizationScore = utilization < 30 ? 95 : utilization < 50 ? 65 : 30;
  const paymentHistoryScore = 100;
  const overall = Math.round((utilizationScore + paymentHistoryScore) / 2);
  const color = healthScoreColor(overall);
  const data = [{ value: overall, fill: color }];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-4">
            <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
              <RadialBarChart width={96} height={96} cx="50%" cy="50%" innerRadius="76%" outerRadius="100%" barSize={10} data={data} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={6} isAnimationActive animationDuration={900} />
              </RadialBarChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-bold tabular-nums" style={{ color }}>{overall}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Credit Card Health</p>
              <p className="text-xs font-medium" style={{ color }}>{level.label === "Excellent" ? "Excellent" : level.label === "Moderate" ? "Fair" : "Needs attention"}</p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 border-t border-border/50 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 sm:grid-cols-4 text-sm">
            <Stat label="Utilization" value={`${utilization.toFixed(1)}%`} />
            <Stat label="Payment History" value="100%" />
            <Stat label="Available Credit" value={`₹${available.toLocaleString()}`} />
            <Stat label="Next Payment" value={`₹${paymentDue.toLocaleString()}`} />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
          {level.label === "Excellent" ? "Your credit card usage is currently healthy." : "Consider paying down balances to improve your utilization."}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-semibold text-foreground">{value}</p>
    </div>
  );
}
