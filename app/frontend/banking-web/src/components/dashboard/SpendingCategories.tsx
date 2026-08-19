// "Where is my money going?" - a donut plus a ranked table of the categories
// that actually matter.
//
// Two deliberate constraints:
//  1. Only the top slices get an identity colour; everything else folds into a
//     single neutral "Other" (see lib/chartTokens). That keeps the palette to a
//     validated, colourblind-safe set instead of an unbounded rainbow.
//  2. Percentages are the share of the *same* total the slices sum to, so the
//     column always adds up to 100%. (The previous version divided all-time
//     category spend by this-month's total, which produced meaningless figures
//     like "86%" for a category that was nowhere near 86% of anything.)
import { useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR, type CategorySlice } from "@/lib/chartTokens";

interface SpendingCategoriesProps {
  slices: CategorySlice[];
  total: number;
  selectedCategory: string | null;
  onSelectCategory: (name: string | null) => void;
}

function SliceTooltip({ active, payload, total }: {
  active?: boolean;
  payload?: { payload: CategorySlice }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const pct = total > 0 ? (p.value / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
        {p.name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatINR(p.value)} · {pct.toFixed(1)}%
      </p>
    </div>
  );
}

export function SpendingCategories({ slices, total, selectedCategory, onSelectCategory }: SpendingCategoriesProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  // The aggregate "Other" bucket isn't a real category, so it can't filter.
  const toggle = (slice: CategorySlice) => {
    if (slice.isAggregate) return;
    onSelectCategory(selectedCategory === slice.name ? null : slice.name);
  };

  return (
    <Card className="flex h-full flex-col border-border/70">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Where your money goes</h3>
            <p className="text-sm text-muted-foreground">Spending by category</p>
          </div>
          {selectedCategory && (
            <button onClick={() => onSelectCategory(null)} className="shrink-0 text-xs font-medium text-primary hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {slices.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
            No expenses recorded yet.
          </p>
        ) : (
          <div className="mt-4 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0" style={{ width: 190, height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices as CategorySlice[]}
                    cx="50%" cy="50%" innerRadius={62} outerRadius={90}
                    paddingAngle={2} dataKey="value" nameKey="name"
                    onClick={(e: { payload?: CategorySlice }) => e.payload && toggle(e.payload)}
                    onMouseEnter={(e: { name?: string }) => setHovered(e.name ?? null)}
                    onMouseLeave={() => setHovered(null)}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {slices.map((s) => {
                      const dimmed = selectedCategory != null && selectedCategory !== s.name && hovered !== s.name;
                      return (
                        <Cell
                          key={s.name}
                          fill={s.color}
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                          opacity={dimmed ? 0.35 : 1}
                          style={{ cursor: s.isAggregate ? "default" : "pointer", transition: "opacity 0.2s ease" }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<SliceTooltip total={total} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-bold tabular-nums text-foreground">{formatINR(total)}</p>
                <p className="text-[11px] text-muted-foreground">Total spending</p>
              </div>
            </div>

            <div className="w-full min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Top categories</span>
                <span>Amount</span>
              </div>
              <ul className="space-y-0.5">
                {slices.map((s) => {
                  const pct = total > 0 ? (s.value / total) * 100 : 0;
                  const isSelected = selectedCategory === s.name;
                  return (
                    <li key={s.name}>
                      <button
                        onClick={() => toggle(s)}
                        onMouseEnter={() => setHovered(s.name)}
                        onMouseLeave={() => setHovered(null)}
                        disabled={s.isAggregate}
                        aria-pressed={isSelected}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          isSelected ? "bg-primary/10" : s.isAggregate ? "" : "hover:bg-muted/60"
                        } ${s.isAggregate ? "cursor-default" : ""}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="truncate text-foreground">{s.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 tabular-nums">
                          <span className="text-muted-foreground">{formatINR(s.value)}</span>
                          <span className="w-9 text-right text-xs font-medium text-foreground">{pct.toFixed(0)}%</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <Link to="/analytics" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          View full breakdown <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
