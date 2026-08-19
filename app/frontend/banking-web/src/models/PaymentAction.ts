// Payment model for the human-action payment flow (New Payment / Pay a
// Bill). Deliberately separate from models/Payments.ts (the real
// payment-service data model) - everything here runs on local/session
// state, since this flow isn't wired to a real payment gateway.
export type PaymentActionStatus = "pending" | "upcoming" | "paid" | "failed" | "cancelled";
export type PaymentActionType = "person" | "bill";

export interface PaymentAction {
  id: string;
  type: PaymentActionType;

  recipientName?: string;
  recipientEmail?: string;
  billerName?: string;
  category?: string;
  customerId?: string;

  amount: number;
  status: PaymentActionStatus;
  paymentMethod: string;

  createdAt: string;
  dueDate?: string;
  paidAt?: string;

  transactionId?: string;
  note?: string;
  receiptId?: string;

  failureReason?: string;
}

export interface Recipient {
  name: string;
  email: string;
}

export const SAVED_RECIPIENTS: Recipient[] = [
  { name: "Rahul Sharma", email: "rahul@example.com" },
  { name: "Priya Mehta", email: "priya@example.com" },
  { name: "Arjun Kumar", email: "arjun@example.com" },
];

export interface BillCategory {
  id: string;
  label: string;
  icon: string;
  billers: string[];
}

export const BILL_CATEGORIES: BillCategory[] = [
  { id: "electricity", label: "Electricity", icon: "⚡", billers: ["PowerCorp Electricity", "City Power", "National Electricity"] },
  { id: "internet", label: "Internet", icon: "🌐", billers: ["SecureBank Fiber", "SpeedNet", "CityLink Broadband"] },
  { id: "water", label: "Water", icon: "💧", billers: ["City Water Board", "AquaCity Utilities"] },
  { id: "mobile", label: "Mobile", icon: "📱", billers: ["Airtel", "Jio", "Vi"] },
  { id: "gas", label: "Gas", icon: "🔥", billers: ["City Gas Distribution", "Indraprastha Gas"] },
  { id: "insurance", label: "Insurance", icon: "🛡️", billers: ["SecureBank Life Insurance", "SecureLife Insurance"] },
  { id: "loan", label: "Loan / EMI", icon: "🏦", billers: ["SecureBank Home Loan", "SecureBank Auto Loan"] },
  { id: "credit-card", label: "Credit Card", icon: "💳", billers: ["SecureBank Platinum Card", "SecureBank Gold Card"] },
];
