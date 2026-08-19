import { Card, CardContent } from "@/components/ui/card";
import type { LoanAccount } from "@/models/LoanCenter";

export function LoanOverviewKpis({ loans }: { loans: LoanAccount[] }) {
  const active = loans.filter((l) => l.status === "active");
  const totalOutstanding = active.reduce((s, l) => s + l.outstanding, 0);
  const monthlyEmi = active.reduce((s, l) => s + l.emi, 0);
  const lenders = new Set(active.map((l) => l.lenderId)).size;
  const next = [...active].sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0];

  const items = [
    { label: "Total Outstanding", value: `₹${totalOutstanding.toLocaleString()}`, sub: `Across ${active.length} active loans` },
    { label: "Monthly EMI", value: `₹${monthlyEmi.toLocaleString()}`, sub: "Across all active loans" },
    { label: "Active Loans", value: String(active.length), sub: `Across ${lenders} lenders` },
    { label: "Next EMI", value: next ? `₹${next.emi.toLocaleString()}` : "—", sub: next ? `Due ${new Date(next.nextDueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No upcoming EMI" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{it.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{it.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{it.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
