// Assembles the Credit Score page's view model from the services the app
// already talks to. Components consume the result; none of them fetch or
// compute on their own.
//
// The factors are genuinely cross-service: utilisation comes from cards, the
// repayment record from loans, credit age from the account, and inquiry count
// from the credit event log.
import { useMemo } from "react";
import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { bffClient } from "@/api/bffClient";
import { useAccountDetails, useCards, useLoans, useCreditScore } from "@/hooks/useBankingData";
import {
  bandForScore, milestoneFor, deriveFactors, buildRecommendations,
  monthlyActivity, activityInsight, estimateScoreTrend, type CreditScoreView,
} from "@/lib/creditScore";

const CREDIT_KEYS = ["creditScore", "creditHistory", "cards", "loans", "account"];

export function useCreditScoreData() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ predicate: (q) => CREDIT_KEYS.includes(String(q.queryKey[0])) }) > 0;

  const scoreQuery = useCreditScore();
  const { data: account } = useAccountDetails();
  const { data: cards = [] } = useCards();
  const { data: loans = [] } = useLoans();
  const historyQuery = useQuery({
    queryKey: ["creditHistory"],
    queryFn: () => bffClient.getCreditHistory(),
    staleTime: 60_000,
  });

  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const score = scoreQuery.data?.score ?? null;

  const view: CreditScoreView = useMemo(() => {
    // credit-service persists neither a score history nor a previous score,
    // so both are estimated from real event impacts, anchored to the one real
    // number we do have (today's score). See lib/creditScore's "Point
    // estimates" section for exactly how.
    const trend = score != null ? estimateScoreTrend(history, score) : [];
    return {
      score,
      rating: scoreQuery.data?.rating ?? null,
      lastUpdated: scoreQuery.data?.lastUpdated ?? null,
      band: score != null ? bandForScore(score) : null,
      milestone: score != null ? milestoneFor(score) : null,
      factors: deriveFactors({ cards, loans, accountActivationDate: account?.activationDate, history }),
      recommendations: [],
      history,
      activity: monthlyActivity(history),
      insight: activityInsight(history),
      trend,
      previousScore: trend.length >= 2 ? trend[trend.length - 2].score : null,
    };
  }, [score, scoreQuery.data, cards, loans, account?.activationDate, history]);

  const withRecommendations = useMemo(
    () => ({ ...view, recommendations: buildRecommendations(view.factors) }),
    [view]
  );

  return {
    data: withRecommendations,
    isLoading: scoreQuery.isLoading || historyQuery.isLoading,
    isError: scoreQuery.isError,
    error: scoreQuery.error,
    isRefreshing: isFetching,
    refresh: () => queryClient.invalidateQueries({ predicate: (q) => CREDIT_KEYS.includes(String(q.queryKey[0])) }),
  };
}
