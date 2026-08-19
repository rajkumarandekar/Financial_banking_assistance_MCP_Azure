// Payments page = composition + data derivation only, same discipline as
// Dashboard.tsx. Reading order: header+actions -> KPIs -> analytics
// (status/trend) -> payment management (filter/search/table) + upcoming ->
// auto pay. See lib/payments.ts for exactly which numbers are real
// payment-service data vs. derived, and components/payments/* for the visuals.
import { useMemo, useState } from "react";
import { AlertCircle, Plus, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { usePayments, useLoans } from "@/hooks/useBankingData";
import { useQueryClient } from "@tanstack/react-query";
import { useAgentResponseHandler } from "@/context/AgentResponseContext";
import { computeTotals, computeAverageMonthlyPaid, computeMonthlyTrend } from "@/lib/payments";
import { computeUpcomingEmis } from "@/lib/upcomingEmis";
import { PaymentSummary } from "@/components/payments/PaymentSummary";
import { PaymentStatusChart } from "@/components/payments/PaymentStatusChart";
import { PaymentTrendChart } from "@/components/payments/PaymentTrendChart";
import { PaymentTable, type TableFilter } from "@/components/payments/PaymentTable";
import { UpcomingPayments } from "@/components/dashboard/UpcomingPayments";
import { AutoPayCard } from "@/components/payments/AutoPayCard";
import { PaymentDetailsDrawer } from "@/components/payments/PaymentDetailsDrawer";
import { NewPaymentDrawer } from "@/components/payments/NewPaymentDrawer";
import { PayBillDrawer } from "@/components/payments/PayBillDrawer";
import { PaymentActionSection } from "@/components/payments/PaymentActionSection";
import type { Payment } from "@/models/Payments";

export default function Payments() {
  const queryClient = useQueryClient();
  const { data: payments = [], isLoading, isError } = usePayments();
  const { data: loans = [], isLoading: loansLoading } = useLoans();

  const [filter, setFilter] = useState<TableFilter>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [payBillOpen, setPayBillOpen] = useState(false);

  // Payments can be created by the AI agent in another surface (chat); when
  // that flow completes, refetch so this page doesn't show stale totals.
  useAgentResponseHandler(() => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
  });

  const totals = useMemo(() => computeTotals(payments), [payments]);
  const averageMonthly = useMemo(() => computeAverageMonthlyPaid(payments), [payments]);
  const trend = useMemo(() => computeMonthlyTrend(payments), [payments]);
  const upcomingEmis = useMemo(() => computeUpcomingEmis(loans, 6), [loans]);
  const upcomingAmount = upcomingEmis.reduce((s, e) => s + e.amount, 0);

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date());
  const loading = isLoading || loansLoading;

  const scrollToTable = (nextFilter: TableFilter) => {
    setFilter(nextFilter);
    document.getElementById("all-payments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] animate-fade-in space-y-6 p-4 sm:p-6">
      {/* Header + primary actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">View, manage and track all your payments in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPayBillOpen(true)}>
            <Receipt className="mr-2 h-4 w-4" />Pay a Bill
          </Button>
          <Button onClick={() => setNewPaymentOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />New Payment
          </Button>
        </div>
      </div>

      {loading ? (
        <PaymentsSkeleton />
      ) : isError ? (
        <Card className="border-border/70">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">Unable to load payments</p>
              <p className="mt-1 text-sm text-muted-foreground">Something went wrong while loading your payment activity.</p>
            </div>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["payments"] })}>
              <RefreshCw className="mr-2 h-4 w-4" />Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <PaymentSummary
            pendingAmount={totals.pendingAmount} pendingCount={totals.pendingCount}
            paidAmount={totals.paidThisMonthAmount} paidCount={totals.paidThisMonthCount}
            averageMonthly={averageMonthly}
            upcomingAmount={upcomingAmount} upcomingCount={upcomingEmis.length}
            onViewPending={() => scrollToTable("pending")}
            onViewPaid={() => scrollToTable("paid")}
            onManageBudget={() => document.getElementById("payments-overview")?.scrollIntoView({ behavior: "smooth" })}
            onViewUpcoming={() => document.getElementById("upcoming-payments")?.scrollIntoView({ behavior: "smooth" })}
          />

          {/* Analytics */}
          <div id="payments-overview" className="scroll-mt-6">
            <h2 className="mb-3 text-base font-semibold text-foreground">Payments Overview</h2>
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <PaymentStatusChart
                paidCount={totals.paidCount} pendingCount={totals.pendingCount}
                upcomingCount={upcomingEmis.length} failedCount={totals.failedCount}
                paidAmount={totals.paidAmount} pendingAmount={totals.pendingAmount}
              />
              <PaymentTrendChart data={trend} monthLabel={monthLabel} />
            </div>
          </div>

          {/* Management + upcoming */}
          {/* min-w-0 on the first column is load-bearing: CSS grid items default
              to min-width:auto, so without it the table's long, un-truncated
              payment names could force this column (and the whole page) wider
              than the viewport before `truncate` ever gets a bounded width to
              truncate against. */}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div id="all-payments" className="min-w-0 space-y-6 scroll-mt-6">
              <PaymentTable
                payments={payments}
                filter={filter}
                onFilterChange={setFilter}
                onSelect={setSelectedPayment}
                onPayNow={setSelectedPayment}
              />
              {/* Human-action payment flow - separate from the real
                  payment-service data above, so these locally-processed
                  amounts never blend into real KPI/analytics figures.
                  Lives in this column (not below the whole grid) so it
                  fills the space next to the taller upcoming-payments
                  sidebar instead of leaving it empty. */}
              <PaymentActionSection />
            </div>
            <div id="upcoming-payments" className="space-y-6 scroll-mt-6">
              <UpcomingPayments items={upcomingEmis} />
              <AutoPayCard />
            </div>
          </div>
        </>
      )}

      <NewPaymentDrawer open={newPaymentOpen} onOpenChange={setNewPaymentOpen} onCompleted={() => {}} />
      <PayBillDrawer open={payBillOpen} onOpenChange={setPayBillOpen} onCompleted={() => {}} />
      <PaymentDetailsDrawer payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
    </div>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[420px] rounded-xl" />
        <div className="space-y-6">
          <Skeleton className="h-[220px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

