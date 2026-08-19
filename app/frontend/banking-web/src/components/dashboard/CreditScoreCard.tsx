// Credit score as an instrument, not a number in a box.
//
// Reads left-to-right as: where am I now -> what band is that -> how far to the
// next milestone -> what do I do about it. The needle angle is derived from the
// live score on every frame (never a fixed image), sweeping up from the minimum
// on mount so the motion itself communicates "this is measured".
//
// Colour runs critical -> excellent (red at 300, green at 850) so the gauge
// agrees with the rest of the dashboard's semantic palette, where green always
// means "financially favourable".
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MIN_SCORE = 300;
const MAX_SCORE = 850;

interface Band {
  label: string;
  from: number;
  to: number;
  color: string;
  description: string;
}

export const BANDS: Band[] = [
  { label: "Poor", from: 300, to: 579, color: "#dc2626", description: "Limited approval odds; focus on on-time payments." },
  { label: "Fair", from: 580, to: 669, color: "#f97316", description: "Below-average profile with room to strengthen." },
  { label: "Good", from: 670, to: 739, color: "#eab308", description: "Solid profile accepted by most lenders." },
  { label: "Very Good", from: 740, to: 799, color: "#84cc16", description: "Strong profile with favourable lending rates." },
  { label: "Excellent", from: 800, to: 850, color: "#16a34a", description: "Top-tier profile; qualifies for the best rates." },
];

// Viewbox geometry. The card scales via viewBox, so these stay constant.
// The viewBox stops just below the pivot and the score readout is a normal
// block *under* the SVG - keeping it inside the arc would put it on top of the
// needle at mid-range scores, which is exactly where the needle spends most of
// its time.
const CX = 150;
const CY = 150;
const RADIUS = 108;
const TRACK = 22;
const TICK_RADIUS = RADIUS + TRACK / 2 + 11; // keeps "300"/"850" inside the viewBox
const GAP_DEG = 2.2; // wedge separator, so adjacent bands never touch

function polar(radius: number, fraction: number) {
  const rad = ((180 - fraction * 180) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function toFraction(score: number) {
  return (Math.min(Math.max(score, MIN_SCORE), MAX_SCORE) - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
}

/** Arc path between two score fractions, inset by a small angular gap. */
function bandPath(startFrac: number, endFrac: number) {
  const gap = GAP_DEG / 180;
  const s = Math.min(startFrac + gap / 2, endFrac);
  const e = Math.max(endFrac - gap / 2, startFrac);
  const p0 = polar(RADIUS, s);
  const p1 = polar(RADIUS, e);
  return `M ${p0.x} ${p0.y} A ${RADIUS} ${RADIUS} 0 0 1 ${p1.x} ${p1.y}`;
}

/** Shared with KpiGrid so the "points to next band" figure matches exactly. */
export function getNextBandInfo(score: number | null | undefined): {
  pointsToNext: number | null;
  nextBandLabel?: string;
  rating?: string;
} {
  if (score == null) return { pointsToNext: null };
  const active = BANDS.find((b) => score >= b.from && score <= b.to) ?? BANDS[0];
  const next = BANDS[BANDS.indexOf(active) + 1];
  return { pointsToNext: next ? next.from - score : null, nextBandLabel: next?.label, rating: active.label };
}

interface CreditScoreCardProps {
  score: number | null | undefined;
  rating?: string;
  lastUpdated?: string | null;
}

export function CreditScoreCard({ score, rating, lastUpdated }: CreditScoreCardProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<Band | null>(null);
  const [animated, setAnimated] = useState(MIN_SCORE);

  useEffect(() => {
    if (score == null) return;
    // Per-frame tween. A CSS transition can't animate SVG path geometry, so the
    // needle is interpolated in JS and the whole arc is recomputed each frame.
    const duration = 1100;
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

  const activeBand = score != null ? BANDS.find((b) => score >= b.from && score <= b.to) ?? BANDS[0] : null;
  const nextBand = activeBand ? BANDS[BANDS.indexOf(activeBand) + 1] : null;
  const pointsToNext = nextBand && score != null ? nextBand.from - score : null;

  const fraction = toFraction(animated);
  const tip = polar(RADIUS - TRACK / 2 - 10, fraction);
  const progressToNext =
    nextBand && activeBand && score != null
      ? ((score - activeBand.from) / (nextBand.from - activeBand.from)) * 100
      : 100;

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Credit Score</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleDateString()}` : "Your standing with lenders"}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-1 flex-col gap-5 lg:flex-row lg:items-center">
          {/* Gauge */}
          <div className="relative mx-auto w-full max-w-[300px] shrink-0">
            <svg viewBox="0 0 300 166" className="w-full" role="img"
              aria-label={score != null ? `Credit score ${score} out of ${MAX_SCORE}, rated ${activeBand?.label}` : "Credit score unavailable"}>
              {BANDS.map((band) => {
                const isActive = activeBand?.label === band.label;
                const isDimmed = score != null && !isActive && hovered?.label !== band.label;
                return (
                  <path
                    key={band.label}
                    d={bandPath((band.from - MIN_SCORE) / (MAX_SCORE - MIN_SCORE), (band.to - MIN_SCORE) / (MAX_SCORE - MIN_SCORE))}
                    fill="none"
                    stroke={band.color}
                    strokeWidth={isActive ? TRACK + 5 : TRACK}
                    strokeLinecap="butt"
                    // Kept high so the bands stay saturated; the active band is
                    // distinguished by width, not by washing the others out.
                    strokeOpacity={score == null ? 0.35 : isDimmed ? 0.8 : 1}
                    style={{ transition: "stroke-opacity 0.3s ease, stroke-width 0.3s ease", cursor: "pointer" }}
                    onMouseEnter={() => setHovered(band)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}

              {/* Scale ticks at each band boundary */}
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

            {/* Readout sits below the arc, clear of the needle at every score */}
            <div className="mt-1 text-center">
              <p className="text-4xl font-bold tabular-nums leading-none" style={{ color: activeBand?.color ?? "hsl(var(--muted-foreground))" }}>
                {score != null ? Math.round(animated) : "--"}
              </p>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">{activeBand?.label ?? "Not available"}</p>
            </div>

            {hovered && (
              <div role="tooltip" className="pointer-events-none absolute left-1/2 top-0 z-10 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-left shadow-lg">
                <p className="text-xs font-semibold" style={{ color: hovered.color }}>{hovered.from}–{hovered.to}</p>
                <p className="text-sm font-medium text-foreground">{hovered.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{hovered.description}</p>
              </div>
            )}
          </div>

          {/* Next milestone */}
          {score != null && nextBand && pointsToNext != null && (
            <div className="w-full rounded-xl border border-border/70 bg-muted/30 p-4 lg:max-w-[190px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next milestone</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{nextBand.from}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                You're <span className="font-semibold text-foreground">{pointsToNext} points</span> away from {nextBand.label}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar" aria-valuenow={Math.round(progressToNext)} aria-valuemin={0} aria-valuemax={100}
                aria-label={`Progress through the ${activeBand?.label} band`}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(progressToNext, 3)}%`, backgroundColor: nextBand.color }} />
              </div>
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" className="mt-5 w-full justify-between"
          onClick={() => navigate("/credit-score")}>
          See what can improve my score
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
