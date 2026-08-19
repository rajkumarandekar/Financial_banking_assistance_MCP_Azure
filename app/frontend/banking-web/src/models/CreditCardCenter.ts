// Credit Card Management Center models. Card identity/balance/limit come
// from the real account-service (models/CreditCard.ts); everything here -
// payments, freeze state, security settings, rewards, offers, statements,
// applications - runs on local application state, same as the Payments
// and Loans features. Not wired to a real card network or issuer.
export interface CardPaymentRecord {
  id: string;
  cardId: string;
  amount: number;
  method: "full" | "minimum" | "custom";
  paymentAccount: string;
  transactionId: string;
  paidAt: string;
}

export interface CardSecuritySettings {
  onlineTransactions: boolean;
  internationalTransactions: boolean;
  contactlessPayments: boolean;
  atmWithdrawals: boolean;
  dailyTransactionLimit: number;
  dailyOnlineLimit: number;
}

export interface LimitIncreaseRequest {
  id: string;
  cardId: string;
  currentLimit: number;
  requestedLimit: number;
  status: "under_review";
  submittedAt: string;
}

export interface CardOffer {
  id: string;
  name: string;
  headline: string;
  annualFee: number;
  creditLimit: string;
  category: "Cashback" | "Travel" | "Rewards" | "Premium";
}

export interface CardApplication {
  id: string;
  cardName: string;
  status: "under_review" | "approved" | "rejected";
  submittedAt: string;
}

export interface CardReward {
  points: number;
  estimatedValue: number;
  pointsThisMonth: number;
}
