// Transaction Analytics - a refinement of the original page, not a rebuild.
// Same structure (header/filters -> KPIs -> trend charts -> category
// breakdown -> activity/insights), but every figure is now computed from the
// real transaction ledger via lib/transactionAnalytics.ts, filters actually
// drive the whole page, and the page cross-links credit cards and loans
// instead of duplicating their screens.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCards, useTransactions } from "@/hooks/useBankingData";
import { useLoanAccounts } from "@/lib/loanCenterService";
import {
  calculateCategoryBreakdown, calculateCreditCardSpending, calculateLargestTransaction,
  calculatePreviousPeriodComparison, calculateSpendingTrend, calculateTopCategory, calculateTotals,
  distinctCategories, downloadTransactionsCsv, filterByAccount, filterByCategory, filterByRange,
  pctChange, RANGE_LABEL, type RangeKey,
} from "@/lib/transactionAnalytics";
import { downloadAnalyticsReportPdf } from "@/lib/analyticsReportPdf";
import { AnalyticsHeader, type AccountOption } from "@/components/analytics/AnalyticsHeader";
import { AnalyticsKpis, CashFlowInsightBanner } from "@/components/analytics/AnalyticsKpis";
import { TransactionTrendsChart } from "@/components/analytics/TransactionTrendsChart";
import { MonthlyCashFlowChart } from "@/components/analytics/MonthlyCashFlowChart";
import { ExpenseCategoriesAnalysis } from "@/components/analytics/ExpenseCategoriesAnalysis";
import { RecentTransactionsCard } from "@/components/analytics/RecentTransactionsCard";
import { FinancialInsightsCard } from "@/components/analytics/FinancialInsightsCard";

export default function TransactionAnalytics() {
  const navigate = useNavigate();
  const { data: rawTransactions = [] } = useTransactions();
  const { data: cards = [] } = useCards();
  const loans = useLoanAccounts();

  const [range, setRange] = useState<RangeKey>("30d");
  const [category, setCategory] = useState("all");
  const [account, setAccount] = useState("all");
  const [categoryDrilldown, setCategoryDrilldown] = useState<string | null>(null);

  const categories = useMemo(() => distinctCategories(rawTransactions), [rawTransactions]);
  const accountOptions: AccountOption[] = useMemo(() => [
    { value: "all", label: "All Accounts" },
    { value: "primary", label: "Primary Account" },
    ...cards.map((c) => ({ value: c.id, label: `${c.name} •••• ${c.number.slice(-4)}` })),
  ], [cards]);

  // Category + account filters apply everywhere; range then narrows the
  // window for the current-period figures (and defines the comparison
  // window for "vs previous period").
  const categoryAccountFiltered = useMemo(
    () => filterByAccount(filterByCategory(rawTransactions, category), account),
    [rawTransactions, category, account]
  );
  const rangeFiltered = useMemo(() => filterByRange(categoryAccountFiltered, range), [categoryAccountFiltered, range]);

  const totals = useMemo(() => calculateTotals(rangeFiltered), [rangeFiltered]);
  const comparison = useMemo(() => calculatePreviousPeriodComparison(categoryAccountFiltered, range), [categoryAccountFiltered, range]);
  const incomeDelta = pctChange(totals.income, comparison.previous.income);
  const expenseDelta = pctChange(totals.expenses, comparison.previous.expenses);
  const netDelta = pctChange(totals.net, comparison.previous.net);
  const avgDelta = pctChange(totals.avg, comparison.previous.avg);

  const trend = useMemo(() => calculateSpendingTrend(rangeFiltered, range), [rangeFiltered, range]);
  const categoryBreakdown = useMemo(() => calculateCategoryBreakdown(rangeFiltered), [rangeFiltered]);
  const topCategory = calculateTopCategory(categoryBreakdown);
  const largestTransaction = calculateLargestTransaction(rangeFiltered);
  const creditCardSpending = calculateCreditCardSpending(rangeFiltered);

  const activeLoans = loans.filter((l) => l.status === "active");
  const totalMonthlyEmi = activeLoans.reduce((s, l) => s + l.emi, 0);

  const handleViewTransactions = (cat: string) => {
    setCategoryDrilldown(cat);
    document.getElementById("recent-transactions")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAskAI = () => {
    navigate("/assistant", { state: { prefill: `Analyze my spending for the last ${RANGE_LABEL[range].toLowerCase()}.` } });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <AnalyticsHeader
        range={range} onRangeChange={setRange}
        category={category} onCategoryChange={setCategory} categories={categories}
        account={account} onAccountChange={setAccount} accountOptions={accountOptions}
        onExportCsv={() => downloadTransactionsCsv(rangeFiltered, RANGE_LABEL[range])}
        onExportPdf={() => downloadAnalyticsReportPdf({ rangeLabel: RANGE_LABEL[range], totals, categories: categoryBreakdown })}
      />

      <AnalyticsKpis totals={totals} incomeDelta={incomeDelta} expenseDelta={expenseDelta} netDelta={netDelta} avgDelta={avgDelta} />

      <CashFlowInsightBanner totals={totals} onViewDetails={() => document.getElementById("expense-categories")?.scrollIntoView({ behavior: "smooth" })} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TransactionTrendsChart data={trend} />
        <MonthlyCashFlowChart transactions={categoryAccountFiltered} />
      </div>

      <ExpenseCategoriesAnalysis
        breakdown={categoryBreakdown}
        transactions={rangeFiltered}
        topCategory={topCategory}
        largestTransaction={largestTransaction}
        totalMonthlyEmi={totalMonthlyEmi}
        activeLoanCount={activeLoans.length}
        creditCardSpending={creditCardSpending}
        onViewTransactions={handleViewTransactions}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <RecentTransactionsCard
            transactions={rangeFiltered}
            categoryFilter={categoryDrilldown}
            onClearFilter={() => setCategoryDrilldown(null)}
          />
        </div>
        <FinancialInsightsCard totals={totals} expenseDelta={expenseDelta} topCategory={topCategory} onAskAI={handleAskAI} />
      </div>
    </div>
  );
}
