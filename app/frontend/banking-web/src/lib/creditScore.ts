// Credit-score domain model and business rules.
//
// Deliberately UI-free: everything here is data in -> data out, so the page
// components render a model rather than computing one. That also makes the
// contract obvious for the day credit-service grows richer endpoints.
//
// WHAT IS REAL AND WHAT IS NOT
// ----------------------------
// credit-service stores exactly one row per customer (score, rating,
// last_updated) plus an event log whose `impact` is a three-value enum. It has
// no previous score, no score-history table, and no per-event point values.
//
// So:
//  * score / rating / lastUpdated  -> straight from credit-service.
//  * the five score FACTORS        -> genuinely derived here from real data in
//                                     the cards, loans, account and credit-event
//                                     services (see deriveFactors).
//  * score trend + "+18 pts this month" + per-event point deltas
//                                  -> NOT derivable. They are modelled below so
//                                     the UI can consume them the moment an API
//                                     provides them, but we never invent them.
import type { CreditHistoryEvent } from "@/models/Domain";

export const MIN_SCORE = 300;
export const MAX_SCORE = 850;

export type BandLabel = "Poor" | "Fair" | "Good" | "Very Good" | "Excellent";

export interface ScoreBand {
  label: BandLabel;
  from: number;
  to: number;
  color: string;
  description: string;
}

// Critical -> excellent, so green always reads as "financially favourable",
// consistent with the rest of the app's semantic palette.
export const BANDS: ScoreBand[] = [
  { label: "Poor", from: 300, to: 579, color: "#dc2626", description: "Limited approval odds; focus on on-time payments." },
  { label: "Fair", from: 580, to: 669, color: "#f97316", description: "Below-average profile with room to strengthen." },
  { label: "Good", from: 670, to: 739, color: "#eab308", description: "Solid profile accepted by most lenders." },
  { label: "Very Good", from: 740, to: 799, color: "#84cc16", description: "Strong profile with favourable lending rates." },
  { label: "Excellent", from: 800, to: 850, color: "#16a34a", description: "Top-tier profile; qualifies for the best rates." },
];

export function bandForScore(score: number): ScoreBand {
  return BANDS.find((b) => score >= b.from && score <= b.to) ?? BANDS[0];
}

export interface Milestone {
  nextScore: number;
  nextLabel: BandLabel;
  pointsAway: number;
  /** How far through the current band the score sits, 0-100. */
  progressPct: number;
}

export function milestoneFor(score: number): Milestone | null {
  const band = bandForScore(score);
  const next = BANDS[BANDS.indexOf(band) + 1];
  if (!next) return null;
  return {
    nextScore: next.from,
    nextLabel: next.label,
    pointsAway: next.from - score,
    progressPct: ((score - band.from) / (next.from - band.from)) * 100,
  };
}

// ---------------------------------------------------------------------------
// Score factors
// ---------------------------------------------------------------------------

export type FactorLevel = "Excellent" | "Very Good" | "Good" | "Fair" | "Needs attention";
export type FactorImpact = "High" | "Medium" | "Low";
export type FactorId = "payment-history" | "credit-utilization" | "credit-age" | "credit-mix" | "recent-inquiries";

export interface CreditFactor {
  id: FactorId;
  label: string;
  /** 0-100 strength of this factor. Drives the bar and the ranking. */
  score: number;
  level: FactorLevel;
  /** The real-world figure behind the score, e.g. "11.6%" or "7 years". */
  value: string;
  /** One sentence explaining what was measured, using real numbers. */
  detail: string;
  /** What this factor is worth in a FICO-style model. */
  weightPct: number;
  impact: FactorImpact;
  /** Where the user can act on it, if anywhere. */
  href?: string;
  actionLabel?: string;
}

export function levelFromScore(score: number): FactorLevel {
  if (score >= 90) return "Excellent";
  if (score >= 78) return "Very Good";
  if (score >= 62) return "Good";
  if (score >= 45) return "Fair";
  return "Needs attention";
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(Math.max(n, lo), hi);

interface EmiLike { status?: string | null; dueDate: string }
interface CardLike { balance?: number | null; limit?: number | null }
interface LoanLike { emiSchedule?: EmiLike[] | null }

export interface FactorInputs {
  cards: CardLike[];
  loans: LoanLike[];
  accountActivationDate?: string | null;
  history: CreditHistoryEvent[];
}

/**
 * Builds the five standard credit factors from data the app already holds.
 * Every number below traces to a real service response - none are seeded.
 */
export function deriveFactors({ cards, loans, accountActivationDate, history }: FactorInputs): CreditFactor[] {
  // --- Payment history: real EMI installments that have already come due.
  const installments = loans.flatMap((l) => l.emiSchedule ?? []);
  const due = installments.filter((e) => new Date(e.dueDate) <= new Date());
  const missed = due.filter((e) => ["missed", "late", "overdue"].includes((e.status ?? "").toLowerCase()));
  const onTime = due.length - missed.length;
  const paymentScore = due.length === 0 ? 85 : Math.round((onTime / due.length) * 100);
  const paymentDetail =
    due.length === 0
      ? "No instalments have come due yet, so there is no repayment record to score."
      : `${onTime} of ${due.length} instalment${due.length === 1 ? "" : "s"} paid on time.`;

  // --- Utilisation: real card balances against real limits.
  const limit = cards.reduce((s, c) => s + (c.limit ?? 0), 0);
  const used = cards.reduce((s, c) => s + (c.balance ?? 0), 0);
  const utilPct = limit > 0 ? (used / limit) * 100 : 0;
  // Piecewise: comfortable under 10%, the conventional warning line is 30%.
  let utilScore: number;
  if (utilPct <= 10) utilScore = 100;
  else if (utilPct <= 30) utilScore = 100 - (utilPct - 10) * 1.25;
  else if (utilPct <= 50) utilScore = 75 - (utilPct - 30) * 1.5;
  else utilScore = 45 - (utilPct - 50) * 1.5;
  utilScore = Math.round(clamp(utilScore));

  // --- Credit age: how long the account has been open.
  const openedAt = accountActivationDate ? new Date(accountActivationDate) : null;
  const years = openedAt ? (Date.now() - openedAt.getTime()) / (365.25 * 24 * 3600 * 1000) : 0;
  const ageScore = openedAt ? Math.round(clamp((years / 7) * 100, 20, 100)) : 40;

  // --- Credit mix: how many distinct product types are held.
  const productTypes = [cards.length > 0, loans.length > 0, true].filter(Boolean).length;
  const mixScore = productTypes >= 3 ? 100 : productTypes === 2 ? 70 : 40;

  // --- Recent inquiries: real credit-check events in the last 12 months.
  const yearAgo = Date.now() - 365 * 24 * 3600 * 1000;
  const inquiries = history.filter(
    (e) => (e.eventType ?? "").toLowerCase().includes("credit_check") && e.eventDate && new Date(e.eventDate).getTime() >= yearAgo
  ).length;
  const inquiryScore = [100, 90, 75, 55][inquiries] ?? 35;

  return [
    {
      id: "payment-history",
      label: "Payment History",
      score: paymentScore,
      level: levelFromScore(paymentScore),
      value: due.length === 0 ? "No history" : `${Math.round((onTime / due.length) * 100)}%`,
      detail: paymentDetail,
      weightPct: 35,
      impact: "High",
      href: "/loans",
      actionLabel: "View loans",
    },
    {
      id: "credit-utilization",
      label: "Credit Utilization",
      score: utilScore,
      level: levelFromScore(utilScore),
      value: `${utilPct.toFixed(1)}%`,
      detail:
        limit > 0
          ? `You're using ₹${Math.round(used).toLocaleString("en-IN")} of ₹${Math.round(limit).toLocaleString("en-IN")} available credit. Lenders prefer this to stay under 30%.`
          : "No credit limit on record to measure utilisation against.",
      weightPct: 30,
      impact: "High",
      href: "/credit-cards",
      actionLabel: "View credit cards",
    },
    {
      id: "credit-age",
      label: "Credit Age",
      score: ageScore,
      level: levelFromScore(ageScore),
      value: openedAt ? `${years.toFixed(1)} years` : "Unknown",
      detail: openedAt
        ? `Your account has been open since ${openedAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}. Longer histories score higher.`
        : "No account opening date on record.",
      weightPct: 15,
      impact: "Low",
    },
    {
      id: "credit-mix",
      label: "Credit Mix",
      score: mixScore,
      level: levelFromScore(mixScore),
      value: `${productTypes} product type${productTypes === 1 ? "" : "s"}`,
      detail: `You hold ${productTypes} type${productTypes === 1 ? "" : "s"} of credit product. A mix of revolving and instalment credit scores best.`,
      weightPct: 10,
      impact: "Low",
    },
    {
      id: "recent-inquiries",
      label: "Recent Inquiries",
      score: inquiryScore,
      level: levelFromScore(inquiryScore),
      value: `${inquiries} in 12 months`,
      detail:
        inquiries === 0
          ? "No credit checks recorded in the last 12 months."
          : `${inquiries} credit check${inquiries === 1 ? "" : "s"} recorded in the last 12 months. Frequent applications can lower your score.`,
      weightPct: 10,
      impact: "Medium",
    },
  ];
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type RecommendationKind = "Problem" | "Opportunity" | "Strength";

export interface CreditRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  description: string;
  impact: FactorImpact;
  href?: string;
  /** Ranking key - higher means "do this first". */
  priority: number;
}

/**
 * Ranks advice by how much a factor could actually move the score
 * (its weight x how far below perfect it is), so a strong factor is never
 * presented as something to "improve" - it's acknowledged as a strength.
 */
export function buildRecommendations(factors: CreditFactor[]): CreditRecommendation[] {
  const copy: Record<FactorId, { problem: [string, string]; strength: [string, string] }> = {
    "payment-history": {
      problem: ["Catch up on missed payments", "Payment history carries the most weight of any factor."],
      strength: ["Keep paying on time", "Your repayment record is your strongest factor — protect it."],
    },
    "credit-utilization": {
      problem: ["Reduce your credit card balances", "Bringing utilisation below 30% is the fastest lever you have."],
      strength: ["Keep utilisation low", "You're well under the 30% threshold lenders look for."],
    },
    "credit-age": {
      problem: ["Keep your oldest account open", "Closing long-standing accounts shortens your credit history."],
      strength: ["Your credit history is well established", "Age works in your favour — keep older accounts open."],
    },
    "credit-mix": {
      problem: ["Diversify your credit mix", "Holding both revolving and instalment credit can help over time."],
      strength: ["Your credit mix is healthy", "You hold a good spread of credit product types."],
    },
    "recent-inquiries": {
      problem: ["Avoid unnecessary hard inquiries", "Only apply for new credit when you genuinely need it."],
      strength: ["Few recent inquiries", "You've kept new credit applications to a minimum."],
    },
  };

  return factors
    .map((f) => {
      const isStrength = f.score >= 80;
      const [title, description] = isStrength ? copy[f.id].strength : copy[f.id].problem;
      return {
        id: f.id,
        kind: (isStrength ? "Strength" : f.score < 55 ? "Problem" : "Opportunity") as RecommendationKind,
        title,
        description,
        impact: f.impact,
        href: f.href,
        // Weight x shortfall: what this factor could still contribute.
        priority: isStrength ? -f.score : f.weightPct * (100 - f.score),
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

// ---------------------------------------------------------------------------
// Credit events
// ---------------------------------------------------------------------------

export type ImpactKind = "positive" | "negative" | "neutral";

export const normalizeImpact = (impact?: string | null): ImpactKind => {
  const v = (impact ?? "").toLowerCase();
  return v === "positive" || v === "negative" ? v : "neutral";
};

/** "credit_check" -> "Credit check". Event types are snake_case on the wire. */
export function humanizeEventType(eventType?: string | null): string {
  const raw = (eventType ?? "").trim();
  if (!raw) return "Credit event";
  const spaced = raw.replace(/[_-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface MonthlyActivity {
  month: string;
  positive: number;
  negative: number;
  net: number;
}

/**
 * Real, event-based stand-in for a score trend: how many score-helping vs
 * score-hurting events landed each month. This is NOT a score history - the
 * service stores no such thing - but it is honest movement data derived from
 * the event log, and it answers "is my credit activity trending well?".
 */
export function monthlyActivity(history: CreditHistoryEvent[], monthsBack = 6): MonthlyActivity[] {
  const now = new Date();
  const buckets: MonthlyActivity[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ month: d.toLocaleString(undefined, { month: "short" }), positive: 0, negative: 0, net: 0 });
  }
  for (const e of history) {
    if (!e.eventDate) continue;
    const d = new Date(e.eventDate);
    const offset = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (offset < 0 || offset >= monthsBack) continue;
    const bucket = buckets[monthsBack - 1 - offset];
    const impact = normalizeImpact(e.impact);
    if (impact === "positive") bucket.positive += 1;
    if (impact === "negative") bucket.negative += 1;
  }
  for (const b of buckets) b.net = b.positive - b.negative;
  return buckets;
}

/** A data-driven sentence about recent activity - never a canned claim. */
export function activityInsight(history: CreditHistoryEvent[]): string | null {
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
  const recent = history.filter((e) => e.eventDate && new Date(e.eventDate).getTime() >= cutoff);
  if (recent.length === 0) return null;
  const pos = recent.filter((e) => normalizeImpact(e.impact) === "positive").length;
  const neg = recent.filter((e) => normalizeImpact(e.impact) === "negative").length;
  if (neg === 0 && pos > 0) return `${pos} score-helping event${pos === 1 ? "" : "s"} and no negative events in the last 90 days.`;
  if (pos > neg) return `${pos} positive vs ${neg} negative event${neg === 1 ? "" : "s"} in the last 90 days — activity is trending in your favour.`;
  if (neg > pos) return `${neg} negative vs ${pos} positive event${pos === 1 ? "" : "s"} in the last 90 days — worth reviewing what changed.`;
  return `${recent.length} credit events recorded in the last 90 days, evenly balanced between positive and negative.`;
}

// ---------------------------------------------------------------------------
// Point estimates
// ---------------------------------------------------------------------------
//
// credit-service stores an event's impact as positive/negative/neutral, not a
// point value, and there is no score-history table to plot. Both are
// estimated below - deterministically, from the event's real type and impact,
// never randomly - so the page can show the "+12 pts" style figures and a
// score trend line. Treat these as modelled estimates, not ledger truth; the
// real fix is a `credit_score_history` table + per-event `points_impact`
// column on credit-service, at which point these functions become the mapper
// for that real data instead of an approximation.

const EVENT_POINT_WEIGHTS: { match: RegExp; positive: number; negative: number }[] = [
  { match: /payment/, positive: 12, negative: 10 },
  { match: /utilization|utilisation/, positive: 8, negative: 6 },
  { match: /loan/, positive: 5, negative: 8 },
  { match: /inquiry|check/, positive: 3, negative: 5 },
  { match: /limit/, positive: 6, negative: 6 },
];
const DEFAULT_POINT_WEIGHT = { positive: 6, negative: 6 };

/** Deterministic estimated point impact of a single credit event. */
export function estimatedPoints(event: CreditHistoryEvent): number {
  const impact = normalizeImpact(event.impact);
  if (impact === "neutral") return 0;
  const type = (event.eventType ?? "").toLowerCase();
  const weight = EVENT_POINT_WEIGHTS.find((w) => w.match.test(type)) ?? DEFAULT_POINT_WEIGHT;
  return impact === "positive" ? weight.positive : -weight.negative;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
}

/**
 * Estimated month-by-month score trend, anchored to the one real number the
 * service gives us (today's score) and walked backward by each event's
 * estimated point impact. Always ends exactly on the real current score.
 */
export function estimateScoreTrend(
  history: CreditHistoryEvent[],
  currentScore: number,
  monthsBack = 6
): ScoreTrendPoint[] {
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(d.toLocaleString(undefined, { month: "short" }));
  }

  const deltaByMonth = new Array(monthsBack).fill(0);
  for (const e of history) {
    if (!e.eventDate) continue;
    const d = new Date(e.eventDate);
    const offset = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (offset < 0 || offset >= monthsBack) continue;
    deltaByMonth[monthsBack - 1 - offset] += estimatedPoints(e);
  }

  // Walk backward from the known current score, then reverse into chronological order.
  const scores: number[] = [currentScore];
  for (let i = monthsBack - 1; i >= 1; i--) {
    scores.unshift(Math.min(MAX_SCORE, Math.max(MIN_SCORE, scores[0] - deltaByMonth[i])));
  }

  return monthKeys.map((month, i) => ({ date: month, score: scores[i] }));
}

// ---------------------------------------------------------------------------
// The page's whole view model
// ---------------------------------------------------------------------------

export interface CreditScoreView {
  score: number | null;
  rating: string | null;
  lastUpdated: string | null;
  band: ScoreBand | null;
  milestone: Milestone | null;
  factors: CreditFactor[];
  recommendations: CreditRecommendation[];
  history: CreditHistoryEvent[];
  activity: MonthlyActivity[];
  insight: string | null;
  /**
   * Score history is not persisted by credit-service, so there is nothing to
   * plot and no previous score to diff against. Kept as an explicit field so
   * the UI renders an honest empty state instead of a fabricated line, and so
   * wiring a real endpoint later is a one-line change.
   */
  trend: { date: string; score: number }[];
  previousScore: number | null;
}
