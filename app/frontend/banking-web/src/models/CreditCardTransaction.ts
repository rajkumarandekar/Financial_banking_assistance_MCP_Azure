// Matches transaction-service's real response shape: amount is always
// positive on the wire, direction is carried by flowType ("outcome" for
// card purchases, "income" for anything credited back to the card) - same
// convention as models/Payments.ts. Never infer direction from the sign
// of amount.
export interface CreditCardTransaction {
  id: string;
  cardId: string;
  description: string;
  amount: number;
  timestamp: string;
  category: string;
  recipientName: string;
  flowType?: "income" | "outcome";
  status?: string;
}
