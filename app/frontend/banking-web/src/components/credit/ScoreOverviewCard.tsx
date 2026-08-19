// The page's anchor: score, band, gauge, and the next milestone.
//
// The needle is computed from the live score every frame (never a static
// image) and sweeps up from the minimum on mount, together with the counting
// number. The readout sits below the arc so it can never collide with the
// needle at mid-range scores.
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BANDS, MIN_SCORE, MAX_SCORE, type ScoreBand, type Milestone } from "@/lib/creditScore";

const CX = 150;
const CY = 150;
const RADIUS = 108;
const TRACK = 22;
const TICK_RADIUS = RADIUS + TRACK / 2 + 11;
const GAP_DEG = 2.2;

const polar = (radius: number, fraction: number) => {
  const rad = ((180 - fraction * 180) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
};

const toFraction = (score: number) =>
  (Math.min(Math.max(score, MIN_SCORE), MAX_SCORE) - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);

function bandPath(from: number, to: number) {
  const gap = GAP_DEG / 180;
  const p0 = polar(RADIUS, Math.min(toFraction(from) + gap / 2, toFraction(to)));
  const p1 = polar(RADIUS, Math.max(toFraction(to) - gap / 2, toFraction(from)));
  return `M ${p0.x} ${p0.y} A ${RADIUS} ${RADIUS} 0 0 1 ${p1.x} ${p1.y}`;
}

interface ScoreOverviewCardProps {
  score: number | null;
  band: ScoreBand | null;
  milestone: Milestone | null;
  /** Rendered only when a real previous score exists; never fabricated. */
  previousScore: number | null;
  onSeeImprovements: () => void;
}

export function ScoreOverviewCard({ score, band, milestone, previousScore, onSeeImprovements }: ScoreOverviewCardProps) {
  const [animated, setAnimated] = useState(MIN_SCORE);
  const [hovered, setHovered] = useState<ScoreBand | null>(null);

  useEffect(() => {
    if (score == null) return;
    // SVG path geometry can't be CSS-transitioned, so the sweep is a real
    // per-frame interpolation that redraws the needle each tick.
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(MIN_SCORE + (score - MIN_SCORE) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const tip = polar(RADIUS - TRACK / 2 - 10, toFraction(animated));
  const delta = score != null && previousScore != null ? score - previousScore : null;

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Your Credit Score</h2>
          {band && (
            <Badge variant="outline" className="border-current" style={{ color: band.color }}>
              {band.label}
            </Badge>
          )}
        </div>

        <div className="mt-3 flex flex-1 flex-col gap-6 lg:flex-row lg:items-center">
          <div className="relative mx-auto w-full max-w-[300px] shrink-0">
            <svg
              viewBox="0 0 300 166"
              className="w-full"
              role="img"
              aria-label={
                score != null
                  ? `Credit score ${score} out of ${MAX_SCORE}, rated ${band?.label}`
                  : "Credit score unavailable"
              }
            >
              {BANDS.map((b) => {
                const active = band?.label === b.label;
                const dim = score != null && !active && hovered?.label !== b.label;
                return (
                  <path
                    key={b.label}
                    d={bandPath(b.from, b.to)}
                    fill="none"
                    stroke={b.color}
                    strokeWidth={active ? TRACK + 5 : TRACK}
                    strokeOpacity={score == null ? 0.35 : dim ? 0.8 : 1}
                    style={{ transition: "stroke-opacity .3s ease, stroke-width .3s ease", cursor: "pointer" }}
                    onMouseEnter={() => setHovered(b)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}

              {[MIN_SCORE, 580, 670, 740, 800, MAX_SCORE].map((v) => {
                const p = polar(TICK_RADIUS, toFraction(v));
                return (
                  <text key={v} x={p.x} y={p.y} fontSize={10} fill="hsl(var(--muted-foreground))"
                    textAnchor="middle" dominantBaseline="middle">
                    {v}
                  </text>
                );
              })}

              {score != null && (
                <g>
                  <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="hsl(var(--foreground))" strokeWidth={3} strokeLinecap="round" />
                  <circle cx={CX} cy={CY} r={8} fill="hsl(var(--foreground))" />
                  <circle cx={CX} cy={CY} r={3.5} fill="hsl(var(--card))" />
                </g>
              )}
            </svg>

            <div className="mt-1 text-center">
              <p className="text-5xl font-bold leading-none tabular-nums" style={{ color: band?.color ?? "hsl(var(--muted-foreground))" }}>
                {score != null ? Math.round(animated) : "--"}
              </p>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">{band?.label ?? "Not available"}</p>
              {delta != null && (
                <p className={`mt-1 text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-rose-600"}`}>
                  {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} points this month
                </p>
              )}
            </div>

            {hovered && (
              <div role="tooltip" className="pointer-events-none absolute left-1/2 top-0 z-10 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
                <p className="text-xs font-semibold" style={{ color: hovered.color }}>{hovered.from}–{hovered.to}</p>
                <p className="text-sm font-medium text-foreground">{hovered.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{hovered.description}</p>
              </div>
            )}
          </div>

          {milestone && (
            <div className="w-full rounded-xl border border-border/70 bg-muted/30 p-4 lg:max-w-[200px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next milestone</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{milestone.nextScore}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{milestone.pointsAway} points</span> to {milestone.nextLabel}
              </p>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(milestone.progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress towards ${milestone.nextLabel}`}
              >
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(milestone.progressPct, 3)}%`, backgroundColor: band?.color }} />
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full justify-between" onClick={onSeeImprovements}>
                See what can improve
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
