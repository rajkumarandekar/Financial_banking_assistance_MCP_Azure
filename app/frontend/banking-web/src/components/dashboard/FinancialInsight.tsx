// A single, earned closing insight - the most actionable true statement we can
// make from the data already on this page. It picks one message by priority
// rather than listing several, so it reads as advice instead of another
// dashboard section. Every branch is derived from real figures; nothing here is
// a canned marketing line.
import { Link } from "react-router-dom";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/chartTokens";
import type { FinancialHealth } from "@/lib/financialHealth";

interface FinancialInsightProps {
  health: FinancialHealth;
  utilizationPct: number;
  cardBalance: number;
  creditLimit: number;
  pointsToNextBand: number | null;
  nextBandLabel?: string;
  spendingChangePct: number | null;
  monthSpend: number;
}

interface Insight {
  message: string;
  href: string;
  cta: string;
}

function pickInsight({
  health, utilizationPct, cardBalance, creditLimit, pointsToNextBand, nextBandLabel, spendingChangePct, monthSpend,
}: FinancialInsightProps): Insight {
  // 1. High utilisation is the single biggest lever on a credit score.
  if (utilizationPct >= 30) {
    const target = creditLimit * 0.3;
    const payDown = Math.max(cardBalance - target, 0);
    return {
      message: `Your credit utilisation is ${utilizationPct.toFixed(1)}%. Paying down ${formatINR(payDown)} would bring it under the 30% threshold lenders prefer.`,
      href: "/credit-cards",
      cta: "Manage cards",
    };
  }

  // 2. A sharp spending increase is worth flagging before it compounds.
  if (spendingChangePct != null && spendingChangePct > 15 && monthSpend > 0) {
    return {
      message: `You've spent ${spendingChangePct.toFixed(0)}% more than last month (${formatINR(monthSpend)} so far). Reviewing your top categories can show where the increase came from.`,
      href: "/analytics",
      cta: "Review spending",
    };
  }

  // 3. Otherwise point at whichever health metric is actually weakest.
  const weakest = [...health.metrics].sort((a, b) => a.score - b.score)[0];
  if (weakest.score < 70) {
    return {
      message: `${weakest.label} is currently your weakest financial-health factor. Improving it would raise your overall score of ${health.overall}/100 the fastest.`,
      href: "/credit-score",
      cta: "See details",
    };
  }

  // 4. Everything healthy - point at the next credit milestone.
  if (pointsToNextBand != null && pointsToNextBand > 0) {
    return {
      message: `Your finances are in good shape. You're ${pointsToNextBand} points from a ${nextBandLabel} credit rating — keeping payments on time is the most reliable way to get there.`,
      href: "/credit-score",
      cta: "View credit score",
    };
  }

  return {
    message: `All four financial-health factors are in good standing, with an overall score of ${health.overall}/100.`,
    href: "/credit-score",
    cta: "View full report",
  };
}

export function FinancialInsight(props: FinancialInsightProps) {
  const insight = pickInsight(props);

  return (
    <Card className="border-primary/25 bg-primary/[0.04]">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Tip for you</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{insight.message}</p>
        </div>
        <Link
          to={insight.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {insight.cta} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
