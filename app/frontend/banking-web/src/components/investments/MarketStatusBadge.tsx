// Live open/closed badge with a real countdown, ticking every second off the
// actual clock (IST market hours) - not a static label.
import { useEffect, useState } from "react";
import { computeMarketStatus } from "@/lib/investmentAnalytics";

export function MarketStatusBadge() {
  const [status, setStatus] = useState(() => computeMarketStatus());

  useEffect(() => {
    const id = setInterval(() => setStatus(computeMarketStatus()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">Market Status</p>
      <p className={`text-sm font-semibold ${status.isOpen ? "text-green-600" : "text-rose-600"}`}>{status.label}</p>
      <p className="text-xs text-muted-foreground tabular-nums">{status.countdownLabel}</p>
    </div>
  );
}
