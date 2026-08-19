// Greeting + freshness line. "Last updated" reflects when React Query actually
// last fetched, and the refresh control re-runs those queries - so the
// timestamp is a real data-freshness indicator rather than decoration.
import { RefreshCw } from "lucide-react";

interface DashboardHeaderProps {
  firstName: string;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({ firstName, lastUpdated, isRefreshing, onRefresh }: DashboardHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's your financial overview for today.</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Last updated:{" "}
          {lastUpdated
            ? `Today, ${lastUpdated.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
            : "—"}
        </span>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh dashboard data"
          className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
