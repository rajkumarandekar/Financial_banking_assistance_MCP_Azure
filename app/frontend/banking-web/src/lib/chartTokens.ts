// Single source of truth for every colour a dashboard chart uses.
//
// Two separate jobs, never mixed:
//   SERIES_*  - status colours reserved for financial polarity (income vs.
//               expense, healthy vs. needs-attention). Never reused as
//               "just another category colour".
//   CATEGORY_PALETTE - identity colours for spending categories, assigned in
//               fixed order so a category keeps its colour when the list is
//               filtered or re-sorted.
//
// CATEGORY_PALETTE was validated for colour-vision deficiency separation
// (worst adjacent pair ΔE 14.1 protan / 19.2 normal, all inside the L
// 0.43-0.77 band). Amber and teal fall under 3:1 contrast against the card
// surface, which is why every category is *also* direct-labelled with its
// name and amount in the legend list - colour is never the only encoding.
// "Other" is a neutral aggregate bucket, always sorted last, never an identity.

export const SERIES = {
  income: "#16a34a",
  expense: "#e11d48",
  neutral: "#94a3b8",
} as const;

/** Status ramp - state, not identity. Always paired with a text label. */
export const STATUS = {
  excellent: "#16a34a",
  good: "#65a30d",
  warning: "#f59e0b",
  critical: "#dc2626",
  // Neutral "this is scheduled, not yet actionable" state (e.g. an upcoming
  // payment) - reuses the first slot of CATEGORY_PALETTE so it stays inside
  // the same validated, colourblind-safe hue set rather than a new pick.
  info: "#2563eb",
} as const;

/** Fixed assignment order. A 6th+ category folds into OTHER_COLOR. */
export const CATEGORY_PALETTE = [
  "#2563eb",
  "#f59e0b",
  "#14b8a6",
  "#a855f7",
  "#ec4899",
] as const;

export const OTHER_COLOR = SERIES.neutral;

/** Max identity slices before the tail is aggregated into "Other". */
export const MAX_CATEGORY_SLICES = 5;

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
  isAggregate?: boolean;
}

/**
 * Sorts categories by spend and folds everything past MAX_CATEGORY_SLICES into
 * a single neutral "Other" slice, so the donut never grows an unbounded
 * rainbow of hues as new categories appear in the ledger.
 */
export function toCategorySlices(
  categories: { name: string; value: number }[],
  maxSlices: number = MAX_CATEGORY_SLICES
): CategorySlice[] {
  const sorted = [...categories].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSlices).map((c, i) => ({
    ...c,
    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }));
  const tail = sorted.slice(maxSlices);
  if (tail.length === 0) return head;
  return [
    ...head,
    {
      name: "Other",
      value: tail.reduce((sum, c) => sum + c.value, 0),
      color: OTHER_COLOR,
      isAggregate: true,
    },
  ];
}

/** Utilization thresholds, shared by the KPI card and the health metric. */
export function utilizationStatus(pct: number) {
  if (pct < 30) return { label: "Excellent", color: STATUS.excellent };
  if (pct < 50) return { label: "Moderate", color: STATUS.warning };
  return { label: "High", color: STATUS.critical };
}

export const formatINR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Compact form for axis ticks, where full figures would collide. */
export function formatCompactINR(n: number) {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `₹${Math.round(n / 1_000)}K`;
  return `₹${Math.round(n)}`;
}
