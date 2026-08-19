// The "why is my score what it is" section. Every row is a real measurement
// (see lib/creditScore#deriveFactors) and opens a drawer explaining what was
// measured, what good looks like, and where to act on it.
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck, Gauge, Clock, Layers, Search, ArrowRight, Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS } from "@/lib/chartTokens";
import type { CreditFactor, FactorId, FactorLevel } from "@/lib/creditScore";

const FACTOR_ICON: Record<FactorId, typeof Gauge> = {
  "payment-history": CalendarCheck,
  "credit-utilization": Gauge,
  "credit-age": Clock,
  "credit-mix": Layers,
  "recent-inquiries": Search,
};

const LEVEL_COLOR: Record<FactorLevel, string> = {
  Excellent: STATUS.excellent,
  "Very Good": STATUS.good,
  Good: STATUS.good,
  Fair: STATUS.warning,
  "Needs attention": STATUS.critical,
};

export function ScoreFactorsCard({ factors }: { factors: CreditFactor[] }) {
  const [selected, setSelected] = useState<CreditFactor | null>(null);

  return (
    <>
      <Card className="flex h-full flex-col border-border/70">
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-semibold text-foreground">Score Factors</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="How score factors are calculated"
                  className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px]">
                Derived from your real accounts, cards, loans and credit events. Percentages show factor strength, and each factor's weight follows a standard scoring model.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">What's affecting your credit score</p>

          <ul className="mt-4 flex-1 space-y-3.5">
            {factors.map((f) => {
              const Icon = FACTOR_ICON[f.id];
              const color = LEVEL_COLOR[f.level];
              return (
                <li key={f.id}>
                  <button
                    onClick={() => setSelected(f)}
                    className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${f.label}: ${f.level}, ${f.value}. View details`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{f.label}</span>
                        <span className="block text-xs" style={{ color }}>{f.level}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{f.value}</span>
                    </div>
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar" aria-valuenow={f.score} aria-valuemin={0} aria-valuemax={100}
                      aria-label={`${f.label} strength`}
                    >
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${f.score}%`, backgroundColor: color }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Sheet open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="bg-card">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.label}</SheetTitle>
                <SheetDescription>Contributes about {selected.weightPct}% of a standard credit score.</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-4xl font-bold tabular-nums" style={{ color: LEVEL_COLOR[selected.level] }}>
                    {selected.value}
                  </p>
                  <p className="mt-1 text-sm font-medium" style={{ color: LEVEL_COLOR[selected.level] }}>{selected.level}</p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar" aria-valuenow={selected.score} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full" style={{ width: `${selected.score}%`, backgroundColor: LEVEL_COLOR[selected.level] }} />
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-sm text-foreground">{selected.detail}</p>
                </div>

                <dl className="space-y-3 text-sm">
                  <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                    <dt className="text-muted-foreground">Weight in score</dt>
                    <dd className="font-medium text-foreground">{selected.weightPct}%</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                    <dt className="text-muted-foreground">Potential impact</dt>
                    <dd className="font-medium text-foreground">{selected.impact}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Factor strength</dt>
                    <dd className="font-medium text-foreground">{selected.score}/100</dd>
                  </div>
                </dl>

                {selected.href && selected.actionLabel && (
                  <Link
                    to={selected.href}
                    onClick={() => setSelected(null)}
                    className="inline-flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {selected.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
