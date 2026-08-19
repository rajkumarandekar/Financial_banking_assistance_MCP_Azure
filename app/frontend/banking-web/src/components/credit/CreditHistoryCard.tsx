// Full credit event log - the original page's only real content, kept intact
// but made scannable: readable event titles instead of raw `credit_check`
// snake_case, recognisable icons, and impact filters.
import { forwardRef, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, AlertTriangle, CircleDot, Landmark, Search, CreditCard, FileText,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { normalizeImpact, humanizeEventType, type ImpactKind } from "@/lib/creditScore";
import type { CreditHistoryEvent } from "@/models/Domain";

const PAGE_SIZE = 5;

const IMPACT_STYLE: Record<ImpactKind, { icon: typeof CheckCircle2; label: string; chip: string }> = {
  positive: { icon: CheckCircle2, label: "Positive", chip: "border-green-200 bg-green-50 text-green-700" },
  negative: { icon: AlertTriangle, label: "Negative", chip: "border-rose-200 bg-rose-50 text-rose-700" },
  neutral: { icon: CircleDot, label: "Neutral", chip: "border-border bg-muted text-muted-foreground" },
};

/** Picks an icon from the event type, falling back to the impact icon. */
function eventIcon(eventType?: string | null) {
  const t = (eventType ?? "").toLowerCase();
  if (t.includes("loan")) return Landmark;
  if (t.includes("check") || t.includes("inquiry")) return Search;
  if (t.includes("payment") || t.includes("card")) return CreditCard;
  return FileText;
}

type Filter = "All" | "Positive" | "Negative" | "Neutral";
const FILTERS: Filter[] = ["All", "Positive", "Negative", "Neutral"];

export const CreditHistoryCard = forwardRef<HTMLDivElement, { history: CreditHistoryEvent[] }>(
  function CreditHistoryCard({ history }, ref) {
    const [filter, setFilter] = useState<Filter>("All");
    const [page, setPage] = useState(0);

    const rows = useMemo(() => {
      const sorted = [...history].sort(
        (a, b) => new Date(b.eventDate ?? 0).getTime() - new Date(a.eventDate ?? 0).getTime()
      );
      if (filter === "All") return sorted;
      return sorted.filter((e) => normalizeImpact(e.impact) === filter.toLowerCase());
    }, [history, filter]);

    // Changing the filter (or the underlying data shrinking) can leave `page`
    // pointing past the end - snap back to page 0 rather than render a gap.
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    useEffect(() => setPage(0), [filter]);
    const safePage = Math.min(page, pageCount - 1);
    const paged = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    const counts = useMemo(() => {
      const c = { All: history.length, Positive: 0, Negative: 0, Neutral: 0 };
      for (const e of history) {
        const k = normalizeImpact(e.impact);
        if (k === "positive") c.Positive += 1;
        else if (k === "negative") c.Negative += 1;
        else c.Neutral += 1;
      }
      return c;
    }, [history]);

    return (
      <Card ref={ref} className="border-border/70 scroll-mt-6">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-foreground">Credit History</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">All activity affecting your credit</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter credit history by impact">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {f} <span className="tabular-nums opacity-70">({counts[f]})</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {history.length === 0 ? "No credit history events yet." : `No ${filter.toLowerCase()} events recorded.`}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {paged.map((e, i) => {
                const impact = normalizeImpact(e.impact);
                const style = IMPACT_STYLE[impact];
                const Icon = eventIcon(e.eventType);
                return (
                  <li key={e.id ?? `${e.eventType}-${e.eventDate}-${i}`} className="flex items-start gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{humanizeEventType(e.eventType)}</p>
                      {e.description && <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {e.eventDate
                          ? new Date(e.eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                          : "--"}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.chip}`}>
                        {style.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {rows.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, rows.length)} of {rows.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[64px] text-center text-xs text-muted-foreground">
                  Page {safePage + 1} of {pageCount}
                </span>
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
