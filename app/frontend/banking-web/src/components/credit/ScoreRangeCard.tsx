// The full scale, with the user's current band called out. Band identity is
// carried by a coloured dot *and* a "Current" pill - never colour alone.
import { Card, CardContent } from "@/components/ui/card";
import { BANDS, MIN_SCORE, MAX_SCORE, type ScoreBand } from "@/lib/creditScore";

export function ScoreRangeCard({ band }: { band: ScoreBand | null }) {
  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <h2 className="text-base font-semibold text-foreground">Score Range</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {MIN_SCORE} (Poor) — {MAX_SCORE} (Excellent)
        </p>

        <ul className="mt-4 flex-1 space-y-1">
          {BANDS.map((b) => {
            const current = band?.label === b.label;
            return (
              <li
                key={b.label}
                aria-current={current ? "true" : undefined}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                  current ? "bg-muted/70 ring-1 ring-border" : ""
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} aria-hidden="true" />
                <span className="w-[86px] shrink-0 tabular-nums text-muted-foreground">{b.from}–{b.to}</span>
                <span className={`truncate ${current ? "font-semibold text-foreground" : "text-foreground"}`}>{b.label}</span>
                {current && (
                  <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Current
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Scores follow a standard 300–850 scale. Most lenders approve mainstream products from 670 upwards.
        </p>
      </CardContent>
    </Card>
  );
}
