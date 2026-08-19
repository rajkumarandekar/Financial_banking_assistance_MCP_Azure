// The "first five seconds" row: balance, credit headroom, utilisation, credit
// score, financial health. Deliberately compact - these answer *what* the
// numbers are; the sections below answer *why*. Every figure is a prop derived
// from live service data upstream in Dashboard.tsx.
//
// Deltas are only rendered when a real prior period exists to compare against;
// there is no invented "+18 this month" when the backend has no score history.
import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { formatINR, utilizationStatus, STATUS } from "@/lib/chartTokens";

function KpiCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-md">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Signed change line. Green for a favourable move, red for an adverse one. */
function Delta({ value, pct, favourableWhenPositive = true }: { value: number; pct: number | null; favourableWhenPositive?: boolean }) {
  const positive = value >= 0;
  const favourable = favourableWhenPositive ? positive : !positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${favourable ? "text-green-600" : "text-rose-600"}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {formatINR(Math.abs(value))}
        {pct != null && ` (${Math.abs(pct).toFixed(1)}%)`} this month
      </span>
    </p>
  );
}

interface KpiGridProps {
  balance: number | null;
  accountId?: string;
  balanceChange: number | null;
  balanceChangePct: number | null;
  availableCredit: number;
  creditLimit: number;
  cardBalance: number;
  utilizationPct: number;
  creditScore: number | null | undefined;
  creditScoreRating?: string;
  pointsToNextBand: number | null;
  nextBandLabel?: string;
  healthScore: number;
  healthStatus: string;
}

export function KpiGrid({
  balance,
  accountId,
  balanceChange,
  balanceChangePct,
  availableCredit,
  creditLimit,
  cardBalance,
  utilizationPct,
  creditScore,
  creditScoreRating,
  pointsToNextBand,
  nextBandLabel,
  healthScore,
  healthStatus,
}: KpiGridProps) {
  const animatedBalance = useCountUp(balance ?? 0);
  const animatedAvailable = useCountUp(availableCredit);
  const animatedUtilization = useCountUp(utilizationPct);
  const animatedScore = useCountUp(creditScore ?? 0);
  const animatedHealth = useCountUp(healthScore);

  const utilization = utilizationStatus(utilizationPct);
  const headroomPct = creditLimit > 0 ? Math.min((availableCredit / creditLimit) * 100, 100) : 0;
  const healthColor = healthScore >= 70 ? STATUS.excellent : healthScore >= 45 ? STATUS.warning : STATUS.critical;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard label="Total Balance">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {balance != null ? formatINR(animatedBalance) : "--"}
        </p>
        {accountId && <p className="mt-0.5 text-xs text-muted-foreground">Account {accountId}</p>}
        {balanceChange != null && <Delta value={balanceChange} pct={balanceChangePct} />}
      </KpiCard>

      <KpiCard label="Available Credit">
        <p className="text-2xl font-bold tabular-nums text-foreground">{formatINR(animatedAvailable)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">of {formatINR(creditLimit)} limit</p>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(headroomPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Share of credit limit still available"
        >
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${headroomPct}%` }} />
        </div>
      </KpiCard>

      <KpiCard label="Credit Utilization">
        <p className="text-2xl font-bold tabular-nums" style={{ color: utilization.color }}>
          {animatedUtilization.toFixed(1)}%
        </p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: utilization.color }}>{utilization.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatINR(cardBalance)} used</p>
      </KpiCard>

      <KpiCard label="Credit Score">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {creditScore != null ? Math.round(animatedScore) : "--"}
        </p>
        <p className="mt-0.5 text-xs font-medium capitalize text-muted-foreground">
          {creditScoreRating ?? "Not available"}
        </p>
        {pointsToNextBand != null && pointsToNextBand > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">{pointsToNextBand} pts to {nextBandLabel}</p>
        )}
      </KpiCard>

      <KpiCard label="Financial Health">
        <p className="text-2xl font-bold tabular-nums" style={{ color: healthColor }}>
          {Math.round(animatedHealth)}<span className="text-base font-medium text-muted-foreground">/100</span>
        </p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: healthColor }}>{healthStatus}</p>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={healthScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall financial health score"
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${healthScore}%`, backgroundColor: healthColor }}
          />
        </div>
      </KpiCard>
    </div>
  );
}
