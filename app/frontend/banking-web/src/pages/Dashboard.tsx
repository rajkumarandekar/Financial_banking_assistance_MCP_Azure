// Dashboard = composition + data derivation only. Every visual lives in its own
// component under components/dashboard, so this file stays readable as the
// page's information hierarchy:
//
//   header -> KPIs -> credit score + health -> cash flow -> spending
//   -> quick actions -> transactions + payments -> closing insight
//
// Each section is a different visual weight on purpose; they are not all
// equally prominent.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { bffClient } from "@/api/bffClient";
import {
  useAccountDetails, useCards, useTransactions, useLoans,
  useCreditScore, useDocuments, useCommunications,
} from "@/hooks/useBankingData";
import { computeSmartAlerts, AlertSeverity } from "@/lib/alerts";
import { computeFinancialHealth } from "@/lib/financialHealth";
import { computeBalanceHistory } from "@/lib/balanceHistory";
import { computeMonthlyCashFlow } from "@/lib/cashFlow";
import { computeUpcomingEmis } from "@/lib/upcomingEmis";
import { computeCardTotals } from "@/lib/creditCardService";
import { toCategorySlices } from "@/lib/chartTokens";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { CreditScoreCard, getNextBandInfo } from "@/components/dashboard/CreditScoreCard";
import { FinancialHealthCard } from "@/components/dashboard/FinancialHealthCard";
import { CashFlowCard } from "@/components/dashboard/CashFlowCard";
import { SpendingCategories } from "@/components/dashboard/SpendingCategories";
import { SpendingTrendCard } from "@/components/dashboard/SpendingTrendCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { UpcomingPayments } from "@/components/dashboard/UpcomingPayments";
import { FinancialInsight } from "@/components/dashboard/FinancialInsight";
import { ImportantUpdates } from "@/components/dashboard/ImportantUpdates";

const ALERT_STYLES: Record<AlertSeverity, { className: string; icon: typeof AlertTriangle }> = {
  critical: { className: "border-red-300 bg-red-50 text-red-900 [&>svg]:text-red-600", icon: ShieldAlert },
  warning: { className: "border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600", icon: AlertTriangle },
  info: { className: "border-primary/30 bg-primary/5 text-foreground [&>svg]:text-primary", icon: Info },
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching() > 0;

  const { data: account, isLoading: accountLoading, dataUpdatedAt } = useAccountDetails();
  const { data: cards = [], isLoading: cardsLoading } = useCards();
  // Payments made via New Payment / Pay a Bill on the Payments page now
  // execute for real (payment-service notifies transaction-service on
  // success), so they already appear here as real transactions - no local
  // merge needed, unlike when that flow was a local-only simulation.
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { data: loans = [], isLoading: loansLoading } = useLoans();
  const { data: creditScore, isLoading: creditScoreLoading } = useCreditScore();
  const { data: documents = [] } = useDocuments();
  const { data: communications = [] } = useCommunications();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => bffClient.getUserProfile(),
    staleTime: 60_000,
  });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const totalBalance = account?.balance ?? null;
  // Same computeCardTotals() the Credit Cards page uses - previously this
  // summed every card with no status filter at all, so a blocked card's
  // limit/balance still counted here even though the Credit Cards page's own
  // KPIs excluded it (confirmed live: the two pages disagreed by the full
  // amount of the blocked card).
  const { totalLimit: totalCreditLimit, totalOutstanding: totalCardBalance, availableCredit, utilizationPct: utilizationRate } =
    computeCardTotals(cards);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [transactions]
  );

  // amount is always positive on the wire; flowType ("income"/"outcome") is what
  // actually carries the direction.
  const expenseCategories = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const t of transactions) {
      if (t.flowType === "income") continue;
      const cat = t.category || "Other";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(t.amount));
    }
    return Array.from(byCategory.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  // Always 12 consecutive, zero-filled months - not just whichever months
  // happened to have a transaction - so the chart is evenly spaced and the
  // "6 Months / 1 Year" toggle always has real months to reveal.
  const cashFlow = useMemo(() => computeMonthlyCashFlow(transactions, 12), [transactions]);

  // The donut's slices and its total must come from the same set, otherwise the
  // percentage column doesn't sum to 100%.
  const categorySlices = useMemo(() => toCategorySlices(expenseCategories), [expenseCategories]);
  const categoryTotal = useMemo(() => categorySlices.reduce((s, c) => s + c.value, 0), [categorySlices]);

  const upcomingEmis = useMemo(() => computeUpcomingEmis(loans), [loans]);

  const balanceHistory = useMemo(
    () => computeBalanceHistory(totalBalance ?? 0, transactions, 6),
    [totalBalance, transactions]
  );

  const balanceChange = useMemo(() => {
    if (balanceHistory.length < 2) return null;
    return balanceHistory[balanceHistory.length - 1].balance - balanceHistory[balanceHistory.length - 2].balance;
  }, [balanceHistory]);

  const balanceChangePct = useMemo(() => {
    if (balanceChange == null || balanceHistory.length < 2) return null;
    const prior = balanceHistory[balanceHistory.length - 2].balance;
    return prior !== 0 ? (balanceChange / prior) * 100 : null;
  }, [balanceChange, balanceHistory]);

  const financialHealth = useMemo(
    () =>
      computeFinancialHealth({
        utilizationRate,
        loans,
        cashFlow,
        balanceHistory: balanceHistory.map((p) => p.balance),
      }),
    [utilizationRate, loans, cashFlow, balanceHistory]
  );

  const spendingChangePct = useMemo(() => {
    if (cashFlow.length < 2) return null;
    const last = cashFlow[cashFlow.length - 1];
    const prev = cashFlow[cashFlow.length - 2];
    return prev.expenses !== 0 ? ((last.expenses - prev.expenses) / prev.expenses) * 100 : null;
  }, [cashFlow]);

  const latestMonthSpend = cashFlow[cashFlow.length - 1]?.expenses ?? 0;
  const { pointsToNext, nextBandLabel, rating: creditRating } = getNextBandInfo(creditScore?.score);
  const alerts = computeSmartAlerts({ account, cards, loans, creditScore });

  const metricsLoading = accountLoading || cardsLoading || creditScoreLoading;
  const firstName = profile?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto w-full max-w-[1600px] animate-fade-in space-y-6 p-4 sm:p-6">
      <DashboardHeader
        firstName={firstName}
        lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        isRefreshing={isFetching}
        onRefresh={() => queryClient.invalidateQueries()}
      />

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const { className, icon: Icon } = ALERT_STYLES[alert.severity];
            return (
              <Alert key={alert.id} className={className}>
                <Icon className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      {/* 1 - Primary KPIs */}
      {metricsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-xl" />)}
        </div>
      ) : (
        <KpiGrid
          balance={totalBalance}
          accountId={account?.id}
          balanceChange={balanceChange}
          balanceChangePct={balanceChangePct}
          availableCredit={availableCredit}
          creditLimit={totalCreditLimit}
          cardBalance={totalCardBalance}
          utilizationPct={utilizationRate}
          creditScore={creditScore?.score}
          creditScoreRating={creditScore?.rating ?? creditRating}
          pointsToNextBand={pointsToNext}
          nextBandLabel={nextBandLabel}
          healthScore={financialHealth.overall}
          healthStatus={financialHealth.status}
        />
      )}

      {/* 2 - Credit score + financial health */}
      {metricsLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : (
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <CreditScoreCard score={creditScore?.score} rating={creditScore?.rating} lastUpdated={creditScore?.lastUpdated} />
          <FinancialHealthCard health={financialHealth} />
        </div>
      )}

      {/* 3 - Cash flow */}
      {transactionsLoading ? <Skeleton className="h-[400px] rounded-xl" /> : <CashFlowCard data={cashFlow} />}

      {/* 4 - Spending analytics */}
      {transactionsLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
      ) : (
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <SpendingCategories
            slices={categorySlices}
            total={categoryTotal}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <SpendingTrendCard data={cashFlow.map((c) => ({ month: c.month, expenses: c.expenses }))} />
        </div>
      )}

      {/* 6 - Activity */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {transactionsLoading ? (
          <Skeleton className="h-[380px] rounded-xl" />
        ) : (
          <RecentTransactions
            transactions={recentTransactions}
            categoryFilter={selectedCategory}
            onClearFilter={() => setSelectedCategory(null)}
          />
        )}
        {loansLoading ? (
          <Skeleton className="h-[380px] rounded-xl" />
        ) : (
          <UpcomingPayments items={upcomingEmis} />
        )}
      </div>

      {/* 7 - Closing insight + recent records */}
      {!metricsLoading && (
        <FinancialInsight
          health={financialHealth}
          utilizationPct={utilizationRate}
          cardBalance={totalCardBalance}
          creditLimit={totalCreditLimit}
          pointsToNextBand={pointsToNext}
          nextBandLabel={nextBandLabel}
          spendingChangePct={spendingChangePct}
          monthSpend={latestMonthSpend}
        />
      )}

      <ImportantUpdates documents={documents} communications={communications} />
    </div>
  );
}
