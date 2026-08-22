// BFFClient for real REST/GraphQL API calls
import { CreditCard } from "@/models/CreditCard";
import { CreditCardTransaction } from "@/models/CreditCardTransaction";
import type { CardSecuritySettings, LimitIncreaseRequest } from "@/models/CreditCardCenter";
import { Payment } from "@/models/Payments";
import { UserProfile } from "@/models/UserProfile";
import { AccountDetails } from "@/models/Account";
import {
  Loan, CreditScore, CreditHistoryEvent, DocumentSummary, CommunicationEvent, PaymentRecord,
  HoldingRecord, StockPriceRecord, StockTransactionRecord,
} from "@/models/Domain";

// The signed-in customer's email, matching customer-service's seeded data
// and app/backend/app/helpers/demo_customer_map.py. There's no real login in
// this local/dev setup (AUTH_ENABLED=false), so the frontend anchors on this
// known email to fetch the REAL customer record - the name/role/id you see
// come from customer-service, not a hardcoded mock, but the identity used
// to look them up still needs a starting point in the absence of a real
// session token.
const SIGNED_IN_CUSTOMER_EMAIL = "rajkumarandekar1144@gmail.com";
const SIGNED_IN_ACCOUNT_ID = "1010";

// What the UI actually displays as the signed-in user's name/email (header,
// avatar, dropdown) - independent of SIGNED_IN_CUSTOMER_EMAIL above, which
// only exists to look up the real backing account's data.
const DISPLAY_NAME = "Rajkumar";
const DISPLAY_EMAIL = "rajkumarandekar1144@gmail.com";

const MOCK_SESSION_TOKEN = "mock-session-token-2025";

const withDelay = <T>(response: T, delay = 200) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(response), delay));

const BACKEND_URI = import.meta.env.VITE_BACKEND_URI ? import.meta.env.VITE_BACKEND_URI : "";


export class BFFClient {
  private baseUrl: string;
  private sessionToken: string | null = null;
  private profileCache: Promise<UserProfile> | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "/api";
  }

  private async graphql<T>(servicePath: string, query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/graphql/${servicePath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new Error(`GraphQL request to ${servicePath} failed`);
    }
    const payload = await response.json();
    if (payload.errors) {
      throw new Error(payload.errors[0]?.message ?? `GraphQL error from ${servicePath}`);
    }
    return payload.data;
  }

  async login(credentials: { email: string; password: string }) {
    if (!credentials.email || !credentials.password) {
      throw new Error("Please provide both email and password.");
    }

    await withDelay(null);
    this.sessionToken = MOCK_SESSION_TOKEN;
    const profile = await this.getUserProfile();

    return {
      token: MOCK_SESSION_TOKEN,
      userId: profile.id,
      expiresIn: 3600
    };
  }

  // Fire-and-forget: a failed login-alert email should never block sign-in
  // itself, so callers don't need to (and shouldn't) await this seriously.
  async sendLoginAlertEmail(customerId: string, recipientEmail: string, deviceInfo: string): Promise<void> {
    await this.graphql<{ sendLoginAlertEmail: unknown }>(
      "communication",
      `mutation($customerId: String!, $recipientEmail: String!, $deviceInfo: String!) {
        sendLoginAlertEmail(customerId: $customerId, recipientEmail: $recipientEmail, deviceInfo: $deviceInfo) { id status }
      }`,
      { customerId, recipientEmail, deviceInfo }
    );
  }

  async getUserProfile(): Promise<UserProfile> {
    if (!this.profileCache) {
      this.profileCache = this.graphql<{ customerByEmail: { id: string; email: string; fullName: string; role: string } | null }>(
        "customer",
        `query($email: String!) { customerByEmail(email: $email) { id email fullName role } }`,
        { email: SIGNED_IN_CUSTOMER_EMAIL }
      ).then((data) => {
        const customer = data.customerByEmail;
        if (!customer) {
          throw new Error(`No customer found for ${SIGNED_IN_CUSTOMER_EMAIL}`);
        }
        return {
          id: customer.id,
          // Display name/email only - overridden here rather than in the
          // seeded customer data, since id/accountId (used for every real
          // data fetch below) still need to resolve to the real backing
          // account. Change DISPLAY_NAME/DISPLAY_EMAIL to update everywhere
          // the signed-in user's name shows up (header, avatar, dropdown).
          name: DISPLAY_NAME,
          email: DISPLAY_EMAIL,
          accountId: SIGNED_IN_ACCOUNT_ID,
          // Empty avatar - Avatar component falls back to initials instead
          // of a picture.
          avatar: "",
          role: customer.role,
        };
      });
    }
    return this.profileCache;
  }

  async getPayments(): Promise<Payment[]> {
    const transactionAPIUrl = `${this.baseUrl}/transactions`;

    const accountId = (await this.getUserProfile()).accountId;
    const response = await fetch(`${transactionAPIUrl}/${accountId}?transaction_type=payment`);
    if (!response.ok) {
      throw new Error("Failed to fetch payments");
    }
    const data = await response.json();
    // Optionally map to Payment instances if needed
    return data;
  }

  async getCards(): Promise<CreditCard[]> {
    const accountsAPIUrl = `${this.baseUrl}/accounts`;

    const accountId = (await this.getUserProfile()).accountId;
    const response = await fetch(`${accountsAPIUrl}/${accountId}/cards`);
    if (!response.ok) {
      throw new Error("Failed to fetch payments");
    }
    const data = await response.json();
    // Optionally map to Payment instances if needed
    return data;
  }

  private async cardPost<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}/cards${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      // account-service's REST errors carry a real, useful message in
      // `detail` (e.g. "Cannot close card with an outstanding balance of
      // 500 - pay it off first") - this used to be thrown away in favor of
      // a generic "Card request failed: /path", so a rejected close/pay/
      // limit-request never told the user why.
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail ?? `Card request failed: ${path}`);
    }
    return response.json();
  }

  freezeCard(cardId: string): Promise<CreditCard> {
    return this.cardPost(`/${cardId}/freeze`);
  }

  unfreezeCard(cardId: string): Promise<CreditCard> {
    return this.cardPost(`/${cardId}/unfreeze`);
  }

  unblockCard(cardId: string): Promise<CreditCard> {
    return this.cardPost(`/${cardId}/unblock`);
  }

  closeCard(cardId: string): Promise<CreditCard> {
    return this.cardPost(`/${cardId}/close`);
  }

  payCardBalance(cardId: string, amount: number): Promise<CreditCard> {
    return this.cardPost(`/${cardId}/pay`, { amount });
  }

  async getCardSecurity(cardId: string): Promise<CardSecuritySettings> {
    const response = await fetch(`${this.baseUrl}/cards/${cardId}/security`);
    if (!response.ok) throw new Error("Failed to fetch card security settings");
    return response.json();
  }

  async updateCardSecurity(cardId: string, patch: Partial<CardSecuritySettings>): Promise<CardSecuritySettings> {
    const response = await fetch(`${this.baseUrl}/cards/${cardId}/security`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error("Failed to update card security settings");
    return response.json();
  }

  async requestCardLimitIncrease(cardId: string, requestedLimit: number): Promise<LimitIncreaseRequest> {
    const response = await fetch(`${this.baseUrl}/cards/${cardId}/limit-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedLimit }),
    });
    if (!response.ok) throw new Error("Failed to submit limit increase request");
    return response.json();
  }

  async issueCard(input: { name: string; type: string; circuit: string; limit: number }): Promise<CreditCard> {
    const accountId = (await this.getUserProfile()).accountId;
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Failed to issue card");
    return response.json();
  }

  async getAccountDetails(): Promise<AccountDetails> {
    const accountsAPIUrl = `${this.baseUrl}/accounts`;

    const accountId = (await this.getUserProfile()).accountId;
    const response = await fetch(`${accountsAPIUrl}/${accountId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch account details");
    }
    return response.json();
  }

  async getTransactions(): Promise<Payment[]> {
    const transactionAPIUrl = `${this.baseUrl}/transactions`;

    const accountId = (await this.getUserProfile()).accountId;
    const response = await fetch(`${transactionAPIUrl}/${accountId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch transactions");
    }
    return response.json();
  }

  async getCardTransactions(cardId: string | null): Promise<CreditCardTransaction[]> {
    const transactionAPIUrl = `${this.baseUrl}/transactions`;

    const accountId = (await this.getUserProfile()).accountId;
    const cardIdParam = cardId ? `&card_id=${cardId}` : "";
    const response = await fetch(`${transactionAPIUrl}/${accountId}?transaction_type=payment&payment_type=CreditCard${cardIdParam}`);
    if (!response.ok) {
      throw new Error("Failed to fetch payments");
    }
    const data = await response.json();
    // Optionally map to Payment instances if needed
    return data;
  }

  async getLoans(): Promise<Loan[]> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ loansByCustomer: Loan[] }>(
      "loan",
      `query($customerId: String!) {
        loansByCustomer(customerId: $customerId) {
          id loanType principalAmount interestRate tenureMonths status appliedDate decisionDate rejectionReason
          emiSchedule { installmentNumber dueDate amount status }
        }
      }`,
      { customerId }
    );
    return data.loansByCustomer;
  }

  async payLoanEmi(loanId: string): Promise<Loan> {
    const data = await this.graphql<{ payEmi: Loan }>(
      "loan",
      `mutation($loanId: String!) {
        payEmi(loanId: $loanId) {
          id loanType principalAmount interestRate tenureMonths status appliedDate decisionDate rejectionReason
          emiSchedule { installmentNumber dueDate amount status }
        }
      }`,
      { loanId }
    );
    return data.payEmi;
  }

  async makeLoanExtraPayment(loanId: string, amount: number): Promise<Loan> {
    const data = await this.graphql<{ makeExtraPayment: Loan }>(
      "loan",
      `mutation($loanId: String!, $amount: Float!) {
        makeExtraPayment(loanId: $loanId, amount: $amount) {
          id loanType principalAmount interestRate tenureMonths status appliedDate decisionDate rejectionReason
          emiSchedule { installmentNumber dueDate amount status }
        }
      }`,
      { loanId, amount }
    );
    return data.makeExtraPayment;
  }

  async applyForLoan(input: {
    loanType: string; principalAmount: number; interestRate: number; tenureMonths: number;
  }): Promise<Loan> {
    const profile = await this.getUserProfile();
    const data = await this.graphql<{ applyLoan: Loan }>(
      "loan",
      `mutation($customerId: String!, $loanType: String!, $principalAmount: Float!, $interestRate: Float!, $tenureMonths: Int!, $accountId: String) {
        applyLoan(customerId: $customerId, loanType: $loanType, principalAmount: $principalAmount, interestRate: $interestRate, tenureMonths: $tenureMonths, accountId: $accountId) {
          id loanType principalAmount interestRate tenureMonths status appliedDate decisionDate rejectionReason
        }
      }`,
      { customerId: profile.id, accountId: profile.accountId, ...input }
    );
    return data.applyLoan;
  }

  private paymentFields = `
    id customerId accountId description recipientName recipientBankCode paymentType
    amount cardId category status failureReason transactionId createdAt
  `;

  async getPaymentActions(): Promise<PaymentRecord[]> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ paymentsByCustomer: PaymentRecord[] }>(
      "payment",
      `query($customerId: String!) { paymentsByCustomer(customerId: $customerId) { ${this.paymentFields} } }`,
      { customerId }
    );
    return data.paymentsByCustomer;
  }

  /** Creates and executes a payment in one atomic backend call (real
   * payment-service mutation - creates the record, notifies transaction-
   * service, and marks paid/failed based on the real outcome). */
  async submitPayment(input: {
    description: string; amount: number; recipientName?: string; recipientBankCode?: string;
    paymentType?: string; cardId?: string; category?: string;
  }): Promise<PaymentRecord> {
    const profile = await this.getUserProfile();
    const data = await this.graphql<{ processPayment: PaymentRecord }>(
      "payment",
      `mutation($customerId: String!, $accountId: String!, $description: String!, $amount: Float!, $recipientName: String, $recipientBankCode: String, $paymentType: String, $cardId: String, $category: String) {
        processPayment(customerId: $customerId, accountId: $accountId, description: $description, amount: $amount, recipientName: $recipientName, recipientBankCode: $recipientBankCode, paymentType: $paymentType, cardId: $cardId, category: $category) {
          ${this.paymentFields}
        }
      }`,
      { customerId: profile.id, accountId: profile.accountId, ...input }
    );
    return data.processPayment;
  }

  async retryPaymentAction(paymentId: string): Promise<PaymentRecord> {
    const data = await this.graphql<{ retryPayment: PaymentRecord }>(
      "payment",
      `mutation($paymentId: String!) { retryPayment(paymentId: $paymentId) { ${this.paymentFields} } }`,
      { paymentId }
    );
    return data.retryPayment;
  }

  async cancelPaymentAction(paymentId: string): Promise<PaymentRecord> {
    const data = await this.graphql<{ cancelPayment: PaymentRecord }>(
      "payment",
      `mutation($paymentId: String!) { cancelPayment(paymentId: $paymentId) { ${this.paymentFields} } }`,
      { paymentId }
    );
    return data.cancelPayment;
  }

  async getHoldings(): Promise<HoldingRecord[]> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ holdingsByCustomer: HoldingRecord[] }>(
      "investment",
      `query($customerId: String!) {
        holdingsByCustomer(customerId: $customerId) {
          id customerId accountId symbol companyName sector shares avgPurchasePrice currentPrice firstPurchasedAt purchasedAt
        }
      }`,
      { customerId }
    );
    return data.holdingsByCustomer;
  }

  async getStockPrices(): Promise<StockPriceRecord[]> {
    const data = await this.graphql<{ stockPrices: StockPriceRecord[] }>(
      "investment",
      `query { stockPrices { symbol companyName price change changePercent volume lastRefreshedAt lastError } }`,
      {}
    );
    return data.stockPrices;
  }

  async getStockTransactions(): Promise<StockTransactionRecord[]> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ transactionsByCustomer: StockTransactionRecord[] }>(
      "investment",
      `query($customerId: String!) {
        transactionsByCustomer(customerId: $customerId) { id customerId symbol type shares price total executedAt }
      }`,
      { customerId }
    );
    return data.transactionsByCustomer;
  }

  async buyStock(input: { symbol: string; companyName?: string; sector?: string; shares: number }): Promise<StockTransactionRecord> {
    const profile = await this.getUserProfile();
    const data = await this.graphql<{ buyStock: StockTransactionRecord }>(
      "investment",
      `mutation($customerId: String!, $accountId: String, $symbol: String!, $companyName: String, $sector: String, $shares: Float!) {
        buyStock(customerId: $customerId, accountId: $accountId, symbol: $symbol, companyName: $companyName, sector: $sector, shares: $shares) {
          id customerId symbol type shares price total executedAt
        }
      }`,
      { customerId: profile.id, accountId: profile.accountId, ...input }
    );
    return data.buyStock;
  }

  async sellStock(symbol: string, shares: number): Promise<StockTransactionRecord> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ sellStock: StockTransactionRecord }>(
      "investment",
      `mutation($customerId: String!, $symbol: String!, $shares: Float!) {
        sellStock(customerId: $customerId, symbol: $symbol, shares: $shares) {
          id customerId symbol type shares price total executedAt
        }
      }`,
      { customerId, symbol, shares }
    );
    return data.sellStock;
  }

  async refreshStockPrices(): Promise<number> {
    const data = await this.graphql<{ refreshPrices: number }>("investment", `mutation { refreshPrices }`, {});
    return data.refreshPrices;
  }

  async getCreditScore(): Promise<CreditScore | null> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ creditScore: CreditScore | null }>(
      "credit",
      `query($customerId: String!) { creditScore(customerId: $customerId) { score rating lastUpdated } }`,
      { customerId }
    );
    return data.creditScore;
  }

  async getCreditHistory(): Promise<CreditHistoryEvent[]> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ creditHistory: CreditHistoryEvent[] }>(
      "credit",
      `query($customerId: String!) { creditHistory(customerId: $customerId) { id eventType description impact eventDate } }`,
      { customerId }
    );
    return data.creditHistory;
  }

  async getDocuments(): Promise<DocumentSummary[]> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ documentsByCustomer: DocumentSummary[] }>(
      "document",
      `query($customerId: String!) { documentsByCustomer(customerId: $customerId) { id documentType title generatedAt } }`,
      { customerId }
    );
    return data.documentsByCustomer;
  }

  async getCommunicationHistory(): Promise<CommunicationEvent[]> {
    const customerId = (await this.getUserProfile()).id;
    const data = await this.graphql<{ communicationHistory: CommunicationEvent[] }>(
      "communication",
      `query($customerId: String!) { communicationHistory(customerId: $customerId) { id channel recipient subject body status sentAt } }`,
      { customerId }
    );
    return data.communicationHistory;
  }
}

export const bffClient = new BFFClient(BACKEND_URI);
