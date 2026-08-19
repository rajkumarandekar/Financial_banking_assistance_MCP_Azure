// Centralized Credit Card Management Center service. Card identity, limit,
// balance, frozen state, security settings, limit-increase requests and
// card issuance are all real account-service data now (Postgres, via REST -
// account-service already had a REST layer, so new writes extend it rather
// than introducing GraphQL into a service that never had it). Only offers/
// rewards/applications-as-a-concept stay local - there's no real card
// marketplace or underwriting queue in this system (card issuance is
// instant, matching the existing UX).
import { useSyncExternalStore } from "react";
import { bffClient } from "@/api/bffClient";
import { queryClient } from "@/lib/queryClient";
import { useCardSecuritySettings } from "@/hooks/useBankingData";
import type { CreditCard } from "@/models/CreditCard";
import type { CreditCardTransaction } from "@/models/CreditCardTransaction";
import type {
  CardPaymentRecord, CardSecuritySettings, LimitIncreaseRequest, CardOffer, CardApplication, CardReward,
} from "@/models/CreditCardCenter";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* best-effort */ }
}

function invalidateCards() {
  queryClient.invalidateQueries({ queryKey: ["cards"] });
}
function invalidateCardTransactions() {
  queryClient.invalidateQueries({ queryKey: ["cardTransactions"] });
}

// --- Freeze / unblock / close ----------------------------------------------
export async function freezeCard(cardId: string): Promise<CreditCard> {
  const card = await bffClient.freezeCard(cardId);
  invalidateCards();
  return card;
}
export async function unfreezeCard(cardId: string): Promise<CreditCard> {
  const card = await bffClient.unfreezeCard(cardId);
  invalidateCards();
  return card;
}
export async function unblockCard(cardId: string): Promise<CreditCard> {
  const card = await bffClient.unblockCard(cardId);
  invalidateCards();
  return card;
}
/** Permanently closes a card (account-service enforces zero balance first).
 * Invalidating ["cards"] is what makes every total that depends on card
 * status - Dashboard's KPIs, the Credit Cards page's own KPIs - recompute
 * immediately from the post-close card list via computeCardTotals(). */
export async function closeCard(cardId: string): Promise<CreditCard> {
  const card = await bffClient.closeCard(cardId);
  invalidateCards();
  return card;
}

// --- Card bill payments ---------------------------------------------------
function generateTxnId(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${d}-${Math.floor(10000 + Math.random() * 90000)}`;
}

/** Pays down a card's balance for real: records the payment via payment-
 * service (which notifies transaction-service - the same real transaction
 * flow "New Payment"/"Pay a Bill" use), then applies it to the card's
 * balance via account-service - only if the payment actually succeeded.
 * If payment-service couldn't record the transaction, the card balance is
 * deliberately left untouched (nothing to "pay down" from a payment that
 * didn't happen) and the caller sees a real failure, not a fabricated one. */
export async function payCardBill(
  card: CreditCard, amount: number, method: CardPaymentRecord["method"], paymentAccount: string
): Promise<CardPaymentRecord> {
  const applied = Math.min(amount, card.balance);

  const paymentResult = await bffClient.submitPayment({
    description: `${card.name} bill payment`,
    amount: applied,
    recipientName: card.name,
    paymentType: "CreditCard",
    cardId: card.id,
    category: "Card Payment",
  });
  if (paymentResult.status !== "paid") {
    queryClient.invalidateQueries({ queryKey: ["paymentActions"] });
    throw new Error(paymentResult.failureReason ?? "Payment could not be processed.");
  }
  await bffClient.payCardBalance(card.id, applied);

  invalidateCards();
  invalidateCardTransactions();
  // Same gap as paymentActionService.ts: this path writes to payment-service
  // (submitPayment above) AND account-service (payCardBalance) - both
  // ["payments"] and ["transactions"] need invalidating too, not just
  // paymentActions, or the Payments page/Dashboard/Analytics stay stale.
  queryClient.invalidateQueries({ queryKey: ["paymentActions"] });
  queryClient.invalidateQueries({ queryKey: ["payments"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });

  return {
    id: paymentResult.id,
    cardId: card.id,
    amount: applied,
    method,
    paymentAccount,
    transactionId: paymentResult.transactionId ?? generateTxnId("CCPAY"),
    paidAt: paymentResult.createdAt ?? new Date().toISOString(),
  };
}

// --- Security settings ---------------------------------------------------
const DEFAULT_SECURITY: CardSecuritySettings = {
  onlineTransactions: true, internationalTransactions: false, contactlessPayments: true, atmWithdrawals: true,
  dailyTransactionLimit: 50000, dailyOnlineLimit: 25000,
};

/** Real security settings for one card. Falls back to defaults while
 * loading (or if the card has none yet) so callers can read fields
 * synchronously without a loading check, same interface as before. */
export function useCardSecurity(cardId: string | null): CardSecuritySettings {
  const { data } = useCardSecuritySettings(cardId);
  return data ?? DEFAULT_SECURITY;
}

export async function updateSecuritySettings(cardId: string, patch: Partial<CardSecuritySettings>): Promise<CardSecuritySettings> {
  const updated = await bffClient.updateCardSecurity(cardId, patch);
  queryClient.invalidateQueries({ queryKey: ["cardSecurity", cardId] });
  return updated;
}

// --- Limit increase requests ----------------------------------------------
export async function requestLimitIncrease(cardId: string, _currentLimit: number, requestedLimit: number): Promise<LimitIncreaseRequest> {
  return bffClient.requestCardLimitIncrease(cardId, requestedLimit);
}

// --- Offers, rewards, applications ----------------------------------------
// No real card marketplace or underwriting queue exists - these stay local,
// same scope boundary as loan-service's LOAN_PRODUCTS/offersForLoan.
export const CARD_OFFERS: CardOffer[] = [
  { id: "travel-platinum", name: "SecureBank Travel Platinum", headline: "2X travel rewards", annualFee: 1499, creditLimit: "Up to ₹5L", category: "Travel" },
  { id: "cashback", name: "SecureBank Cashback Card", headline: "5% cashback", annualFee: 999, creditLimit: "Up to ₹3L", category: "Cashback" },
  { id: "fuel", name: "SecureBank Fuel Card", headline: "Fuel benefits", annualFee: 499, creditLimit: "Up to ₹2L", category: "Cashback" },
  { id: "executive-elite", name: "SecureBank Executive Elite", headline: "Airport lounge + concierge", annualFee: 4999, creditLimit: "Up to ₹10L", category: "Premium" },
];

export const CARD_REWARDS: CardReward = { points: 12450, estimatedValue: 1245, pointsThisMonth: 820 };

const APPLICATIONS_KEY = "meridian_demo_card_applications_v1";
let cardApplications: CardApplication[] = loadJson(APPLICATIONS_KEY, []);
const applicationListeners = new Set<() => void>();

export function useCardApplications(): CardApplication[] {
  return useSyncExternalStore(
    (l) => { applicationListeners.add(l); return () => applicationListeners.delete(l); },
    () => cardApplications,
    () => cardApplications
  );
}

/** Records a local application receipt (id/status/timestamp) alongside the
 * real card issuance in issueCard() - there's no backend "applications"
 * table since issuance is instant, so this is purely a display reference
 * number, not a real pending workflow. */
export function applyForCard(cardName: string): CardApplication {
  const record: CardApplication = {
    id: `CARD-APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    cardName, status: "approved", submittedAt: new Date().toISOString(),
  };
  cardApplications = [record, ...cardApplications];
  saveJson(APPLICATIONS_KEY, cardApplications);
  applicationListeners.forEach((l) => l());
  return record;
}

function parseCreditLimit(text: string): number {
  const match = text.match(/([\d.]+)\s*(L|Cr)/i);
  if (!match) return 100000;
  const n = parseFloat(match[1]);
  return match[2].toUpperCase() === "CR" ? n * 10_000_000 : n * 100_000;
}

/** Issues a real new card via account-service - approved and active
 * immediately (no underwriting queue exists in this system). Invalidates
 * the cards query so it appears through the normal useCards() flow
 * everywhere, no separate "added cards" merge needed. */
export async function issueCard(offer: CardOffer): Promise<CreditCard> {
  const card = await bffClient.issueCard({
    name: offer.name,
    type: "credit",
    circuit: "visa",
    limit: parseCreditLimit(offer.creditLimit),
  });
  invalidateCards();
  return card;
}

// --- Derived aggregates ---------------------------------------------------
/** The one place "total limit / outstanding / available credit /
 * utilization" gets computed - Dashboard.tsx and CardKpis.tsx each used to
 * have their own inline reduce() with different filters (Dashboard summed
 * every card with no filter at all; CardKpis filtered to status==="active").
 * Confirmed live: with one blocked card in the mix, the two pages disagreed
 * by the full amount of that card's limit. Both now call this instead.
 *
 * A blocked or closed card's limit/balance is excluded - it isn't usable
 * credit. A merely frozen card (still "active" status, temporarily disabled
 * by the cardholder) still counts - freezing doesn't cancel the credit line
 * in real banking, only blocks new transactions on it. */
export interface CardTotals {
  totalLimit: number;
  totalOutstanding: number;
  availableCredit: number;
  utilizationPct: number;
  activeCount: number;
}

export function computeCardTotals(cards: CreditCard[]): CardTotals {
  const usable = cards.filter((c) => c.status === "active");
  const totalOutstanding = usable.reduce((sum, c) => sum + (c.balance ?? 0), 0);
  const totalLimit = usable.reduce((sum, c) => sum + (c.limit ?? 0), 0);
  const availableCredit = Math.max(totalLimit - totalOutstanding, 0);
  const utilizationPct = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;
  return { totalLimit, totalOutstanding, availableCredit, utilizationPct, activeCount: usable.length };
}

export function utilizationLevel(pct: number): { label: string; color: string } {
  if (pct < 30) return { label: "Excellent", color: "#16a34a" };
  if (pct < 50) return { label: "Moderate", color: "#f59e0b" };
  return { label: "High", color: "#dc2626" };
}

export function minimumPayment(balance: number): number {
  return Math.round(Math.max(balance * 0.05, balance > 0 ? 500 : 0));
}

export function nextDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 12);
  return d.toISOString();
}
