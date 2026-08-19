// Account Domain Model
export class Account {
  constructor(
    public id: string,
    public name: string,
    public balance: number,
    public type: string,
    public status: string
  ) {}
}

// Matches account-service's GET /api/accounts/{account_id} response
export interface PaymentMethodSummary {
  id: string;
  type: string;
  name?: string | null;
  activationDate?: string | null;
  expirationDate?: string | null;
}

export interface AccountDetails {
  id: string;
  userName: string;
  accountHolderFullName: string;
  currency: string;
  activationDate?: string | null;
  balance: number;
  paymentMethods?: PaymentMethodSummary[] | null;
  customerId: string;
}
