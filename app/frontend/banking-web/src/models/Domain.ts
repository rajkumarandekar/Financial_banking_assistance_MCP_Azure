// Lightweight models for the domains added straight from GraphQL responses
// (loan, credit, document, communication services - GraphQL-only, no REST).

export interface EmiInstallment {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  // Nullable on the wire - guard before calling string methods on it.
  status?: string | null;
}

export interface Loan {
  id: string;
  loanType: string;
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  status: string;
  appliedDate?: string | null;
  decisionDate?: string | null;
  rejectionReason?: string | null;
  emiSchedule?: EmiInstallment[] | null;
}

export interface CreditScore {
  score: number;
  rating: string;
  lastUpdated?: string | null;
}

export interface CreditHistoryEvent {
  id?: string;
  eventType: string;
  description?: string | null;
  impact?: string | null;
  eventDate?: string | null;
}

export interface DocumentSummary {
  id: string;
  documentType: string;
  title: string;
  generatedAt?: string | null;
}

// payment-service's real record shape (payment_schema.payments) - distinct
// from models/Payments.ts's Payment class, which is transaction-service's
// shape (used for the general ledger, not payment-specific lifecycle state
// like failureReason/transactionId/retry).
export interface PaymentRecord {
  id: string;
  customerId: string;
  accountId: string;
  description: string;
  recipientName?: string | null;
  recipientBankCode?: string | null;
  paymentType?: string | null;
  amount: number;
  cardId?: string | null;
  category?: string | null;
  status: string;
  failureReason?: string | null;
  transactionId?: string | null;
  createdAt?: string | null;
}

// investment-service's real record shapes (investment_schema). Prices come
// from Alpha Vantage's real remote MCP server, cached server-side and
// refreshed on a timer - never fetched live per-request.
export interface StockPriceRecord {
  symbol: string;
  companyName?: string | null;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  volume?: number | null;
  lastRefreshedAt?: string | null;
  lastError?: string | null;
}

export interface HoldingRecord {
  id: string;
  customerId: string;
  accountId?: string | null;
  symbol: string;
  companyName: string;
  sector?: string | null;
  shares: number;
  avgPurchasePrice: number;
  currentPrice?: number | null;
}

export interface StockTransactionRecord {
  id: string;
  customerId: string;
  symbol: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  executedAt: string;
}

export interface CommunicationEvent {
  id: string;
  channel: string;
  recipient?: string | null;
  subject?: string | null;
  body: string;
  status: string;
  sentAt?: string | null;
}
