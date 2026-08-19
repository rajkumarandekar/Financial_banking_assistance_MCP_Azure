import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { minimumPayment, nextDueDate } from "@/lib/creditCardService";
import { viewStatement, downloadStatementPdf } from "@/lib/statementPrinter";
import type { CreditCard } from "@/models/CreditCard";

type EffectiveCard = CreditCard & { frozen: boolean };

function pastMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  });
}

export function CardStatements({ card }: { card: EffectiveCard | null }) {
  const { toast } = useToast();
  const [monthIdx, setMonthIdx] = useState(0);
  const months = pastMonths(3);

  if (!card) return null;

  const minDue = minimumPayment(card.balance);
  const due = nextDueDate();
  const isCurrent = monthIdx === 0;
  const statementBalance = isCurrent ? card.balance : Math.round(card.balance * (1 - monthIdx * 0.15));
  const statementMinDue = isCurrent ? minDue : Math.round(minDue * (1 - monthIdx * 0.15));

  const statementData = {
    cardName: card.name,
    last4: card.number.slice(-4),
    monthLabel: months[monthIdx],
    statementBalance,
    minimumDue: statementMinDue,
    dueDate: due,
    creditLimit: card.limit,
  };

  const handleView = () => {
    const opened = viewStatement(statementData);
    if (!opened) toast({ title: "Pop-up blocked", description: "Allow pop-ups for this site to view statements." });
  };

  const handleDownload = () => {
    downloadStatementPdf(statementData);
    toast({ title: "✓ Statement downloaded", description: `${statementData.monthLabel} statement saved as PDF.` });
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">Statements</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {months.map((m, i) => (
            <button
              key={m}
              onClick={() => setMonthIdx(i)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                monthIdx === i ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {m.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg border border-border/60 p-4 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Statement Balance</p>
            <p className="font-semibold text-foreground">₹{statementBalance.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Minimum Due</p>
            <p className="font-semibold text-foreground">₹{statementMinDue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Due Date</p>
            <p className="font-semibold text-foreground">{isCurrent ? new Date(due).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-3">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />{months[monthIdx]} Statement.pdf
          </span>
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleView}>
              <Eye className="mr-1 h-3 w-3" />View Statement
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleDownload}>
              <Download className="mr-1 h-3 w-3" />Download PDF
            </Button>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
