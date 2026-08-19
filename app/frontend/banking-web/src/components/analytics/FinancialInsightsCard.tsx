// 2-3 short, derived statements - analytics intelligence, not a chat
// interface. The "Ask AI" link is the only bridge to the real AI Assistant;
// this card never simulates a conversation itself.
import { TrendingUp, TrendingDown, PiggyBank, Tag, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/chartTokens";
import type { Totals, CategoryRow } from "@/lib/transactionAnalytics";

interface Insight {
  icon: typeof TrendingUp;
  title: string;
  message: string;
}

function buildInsights(totals: Totals, expenseDelta: number | null, topCategory: CategoryRow | null): Insight[] {
  const insights: Insight[] = [];

  if (expenseDelta != null && Math.abs(expenseDelta) >= 3) {
    const up = expenseDelta > 0;
    insights.push({
      icon: up ? TrendingUp : TrendingDown,
      title: up ? "Spending increased" : "Spending decreased",
      message: `Your spending is ${Math.abs(expenseDelta).toFixed(1)}% ${up ? "higher" : "lower"} than the previous period.`,
    });
  }

  if (topCategory) {
    insights.push({
      icon: Tag,
      title: `${topCategory.category} spending`,
      message: `You spent ${formatINR(topCategory.amount)} on ${topCategory.category} this period (${topCategory.percentage}% of expenses).`,
    });
  }

  insights.push({
    icon: PiggyBank,
    title: totals.net >= 0 ? "Cash flow" : "Cash flow deficit",
    message: totals.net >= 0
      ? `Your income exceeded expenses by ${formatINR(totals.net)}.`
      : `Your expenses exceeded income by ${formatINR(Math.abs(totals.net))}.`,
  });

  return insights.slice(0, 3);
}

export function FinancialInsightsCard({ totals, expenseDelta, topCategory, onAskAI }: {
  totals: Totals;
  expenseDelta: number | null;
  topCategory: CategoryRow | null;
  onAskAI: () => void;
}) {
  const insights = buildInsights(totals, expenseDelta, topCategory);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="flex h-full flex-col p-6">
        <h3 className="text-base font-semibold text-foreground">Financial Insights</h3>
        <div className="mt-3 flex-1 space-y-3">
          {insights.map((insight) => (
            <div key={insight.title} className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <insight.icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{insight.title}</p>
                <p className="text-xs text-muted-foreground">{insight.message}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onAskAI}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5" />Ask AI about my spending
        </button>
      </CardContent>
    </Card>
  );
}
