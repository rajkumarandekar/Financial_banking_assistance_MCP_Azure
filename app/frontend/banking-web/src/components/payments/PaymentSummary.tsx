// Four compact KPI cards - the "what's my payment situation" answer in one
// glance. Every figure here is real (payment-service totals or the loan EMI
// schedule); "Monthly Budget" is the real trailing average of paid amounts,
// not an invented constant - see lib/payments#computeAverageMonthlyPaid.
import type { ReactNode } from "react";
import { Clock, CheckCircle2, Wallet, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/chartTokens";

interface PaymentSummaryProps {
  pendingAmount: number;
  pendingCount: number;
  paidAmount: number;
  paidCount: number;
  averageMonthly: number;
  upcomingAmount: number;
  upcomingCount: number;
  onViewPending: () => void;
  onViewPaid: () => void;
  onManageBudget: () => void;
  onViewUpcoming: () => void;
}

function SummaryCard({ label, value, sub, icon, iconClass, link, onClick }: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  iconClass: string;
  link: string;
  onClick: () => void;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</span>
        </div>
        <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        <button onClick={onClick} className="mt-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {link} →
        </button>
      </CardContent>
    </Card>
  );
}

export function PaymentSummary({
  pendingAmount, pendingCount, paidAmount, paidCount, averageMonthly,
  upcomingAmount, upcomingCount, onViewPending, onViewPaid, onManageBudget, onViewUpcoming,
}: PaymentSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Total Pending" value={formatINR(pendingAmount)}
        sub={`${pendingCount} payment${pendingCount === 1 ? "" : "s"} pending`}
        icon={<Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />} iconClass="bg-amber-50"
        link="View pending" onClick={onViewPending}
      />
      <SummaryCard
        label="Paid This Month" value={formatINR(paidAmount)}
        sub={`${paidCount} payment${paidCount === 1 ? "" : "s"} completed`}
        icon={<CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />} iconClass="bg-green-50"
        link="View history" onClick={onViewPaid}
      />
      <SummaryCard
        label="Monthly Average" value={formatINR(averageMonthly)}
        sub="Trailing 3-month paid average"
        icon={<Wallet className="h-4 w-4 text-primary" aria-hidden="true" />} iconClass="bg-primary/10"
        link="View trend" onClick={onManageBudget}
      />
      <SummaryCard
        label="Upcoming" value={formatINR(upcomingAmount)}
        sub={upcomingCount > 0 ? `${upcomingCount} loan instalment${upcomingCount === 1 ? "" : "s"} due soon` : "Nothing scheduled"}
        icon={<CalendarClock className="h-4 w-4 text-blue-600" aria-hidden="true" />} iconClass="bg-blue-50"
        link="View upcoming" onClick={onViewUpcoming}
      />
    </div>
  );
}
