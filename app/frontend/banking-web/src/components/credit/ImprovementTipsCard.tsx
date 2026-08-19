// Advice ranked by what would actually move this user's score - weight of the
// factor multiplied by how far it is from perfect (see buildRecommendations).
//
// A factor the user is already strong at is never phrased as a fix; it appears
// as a "Strength" to protect. That distinction is the whole point of §16.
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CreditRecommendation, RecommendationKind } from "@/lib/creditScore";

const KIND_STYLE: Record<RecommendationKind, { icon: typeof TrendingUp; badge: string; chip: string }> = {
  Problem: { icon: AlertTriangle, badge: "bg-rose-50 text-rose-700", chip: "border-rose-200 text-rose-700" },
  Opportunity: { icon: TrendingUp, badge: "bg-amber-50 text-amber-700", chip: "border-amber-200 text-amber-700" },
  Strength: { icon: ShieldCheck, badge: "bg-green-50 text-green-700", chip: "border-green-200 text-green-700" },
};

export function ImprovementTipsCard({ recommendations }: { recommendations: CreditRecommendation[] }) {
  const top = recommendations.slice(0, 4);

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <h2 className="text-base font-semibold text-foreground">Tips to Improve Your Score</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Ranked by what would move your score most</p>

        <ul className="mt-4 flex-1 space-y-2">
          {top.map((r) => {
            const style = KIND_STYLE[r.kind];
            const Icon = style.icon;
            const body = (
              <>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.badge}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{r.title}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.chip}`}>
                      {r.kind === "Strength" ? "Strength" : `${r.impact} impact`}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{r.description}</span>
                </span>
                {r.href && <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </>
            );

            return (
              <li key={r.id}>
                {r.href ? (
                  <Link
                    to={r.href}
                    className="flex items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Suggestions are generated from your own accounts, cards and loans — not generic advice.
        </p>
      </CardContent>
    </Card>
  );
}
