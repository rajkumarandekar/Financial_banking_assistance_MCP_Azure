// Shared data-fetching hooks built on the app's existing React Query client.
// Using useQuery (instead of ad-hoc useEffect/useState in every page) means
// Navigation's notification bell and Dashboard's cards share one cached
// fetch per resource - no duplicate network calls, automatic loading state,
// and a single place to tune cache/staleness behavior.
import { useQuery } from "@tanstack/react-query";
import { bffClient } from "@/api/bffClient";

const STALE_TIME = 60_000;

export function useAccountDetails() {
  return useQuery({
    queryKey: ["account"],
    queryFn: () => bffClient.getAccountDetails(),
    staleTime: STALE_TIME,
  });
}

export function useCards() {
  return useQuery({
    queryKey: ["cards"],
    queryFn: () => bffClient.getCards(),
    staleTime: STALE_TIME,
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: () => bffClient.getTransactions(),
    staleTime: STALE_TIME,
  });
}

// Same /transactions endpoint as useTransactions, server-filtered to
// transaction_type=payment - the bill/transfer subset, not the full ledger.
export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: () => bffClient.getPayments(),
    staleTime: STALE_TIME,
  });
}

export function useHoldings() {
  return useQuery({
    queryKey: ["holdings"],
    queryFn: () => bffClient.getHoldings(),
    staleTime: STALE_TIME,
  });
}

// Server-cached prices (refreshed from Alpha Vantage's remote MCP server on
// a timer, not live) - short staleTime so a manual "Refresh Prices" click's
// result shows up quickly, but never fetched more often than that.
export function useStockPrices() {
  return useQuery({
    queryKey: ["stockPrices"],
    queryFn: () => bffClient.getStockPrices(),
    staleTime: 30_000,
  });
}

export function useStockTransactions() {
  return useQuery({
    queryKey: ["stockTransactions"],
    queryFn: () => bffClient.getStockTransactions(),
    staleTime: STALE_TIME,
  });
}

export function useCardSecuritySettings(cardId: string | null) {
  return useQuery({
    queryKey: ["cardSecurity", cardId],
    queryFn: () => bffClient.getCardSecurity(cardId as string),
    enabled: cardId != null,
    staleTime: STALE_TIME,
  });
}

// Real payment-service records (create/process/retry/cancel lifecycle) -
// distinct from usePayments() above, which reads transaction-service's
// generic ledger filtered to transaction_type=payment.
export function usePaymentActionRecords() {
  return useQuery({
    queryKey: ["paymentActions"],
    queryFn: () => bffClient.getPaymentActions(),
    staleTime: STALE_TIME,
  });
}

export function useLoans() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: () => bffClient.getLoans(),
    staleTime: STALE_TIME,
  });
}

export function useCreditScore() {
  return useQuery({
    queryKey: ["creditScore"],
    queryFn: () => bffClient.getCreditScore(),
    staleTime: STALE_TIME,
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: () => bffClient.getDocuments(),
    staleTime: STALE_TIME,
  });
}

export function useCommunications() {
  return useQuery({
    queryKey: ["communications"],
    queryFn: () => bffClient.getCommunicationHistory(),
    staleTime: STALE_TIME,
  });
}
