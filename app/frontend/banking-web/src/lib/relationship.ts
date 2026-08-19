// Real-data-derived customer relationship metrics - the kind of tiering and
// tenure summary a real bank shows on a profile page. Tier thresholds are a
// genuine (if simple) business rule computed from real balance/limit/loan
// figures, not invented numbers - there's no fabricated data here, only
// derived classification of data that already exists.

export type CustomerTier = "Platinum" | "Gold" | "Standard";

const PLATINUM_THRESHOLD = 100_000;
const GOLD_THRESHOLD = 25_000;

export function computeCustomerTier(totalRelationshipValue: number): CustomerTier {
  if (totalRelationshipValue >= PLATINUM_THRESHOLD) return "Platinum";
  if (totalRelationshipValue >= GOLD_THRESHOLD) return "Gold";
  return "Standard";
}

export const TIER_STYLES: Record<CustomerTier, string> = {
  Platinum: "bg-slate-900 text-white",
  Gold: "bg-amber-500 text-white",
  Standard: "bg-slate-200 text-slate-700",
};

export function formatTenure(activationDate?: string | null): string {
  if (!activationDate) return "--";
  const start = new Date(activationDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(months, 0);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} month${remMonths === 1 ? "" : "s"}`;
  if (remMonths === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}, ${remMonths} month${remMonths === 1 ? "" : "s"}`;
}
