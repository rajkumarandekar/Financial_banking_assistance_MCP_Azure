// Loans & Lending Center models. Multiple lenders, a marketplace, and
// applications, all running on local application state - not backed by
// the real (single-loan) backend. Not wired to a real lender or credit
// bureau.
export type LoanStatus = "active" | "pending" | "completed" | "overdue";
export type LoanType = "personal" | "auto" | "home" | "education" | "business";

export interface Lender {
  id: string;
  name: string;
  rating: number;
}

export interface LoanAccount {
  id: string;
  type: LoanType;
  lenderId: string;
  lenderName: string;
  principal: number;
  outstanding: number;
  interestRateApr: number;
  tenureMonths: number;
  remainingMonths: number;
  emi: number;
  status: LoanStatus;
  startDate: string;
  nextDueDate: string;
  principalPaid: number;
  interestPaid: number;
}

export interface LoanInstallment {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  amount: number;
  status: "paid" | "upcoming";
}

export interface LoanProduct {
  type: LoanType;
  label: string;
  description: string;
  ratesFrom: number;
  maxAmount: number;
}

export interface LoanOffer {
  lenderId: string;
  lenderName: string;
  rating: number;
  aprPct: number;
  processingFee: number;
}

export type ApplicationStatus = "under_review" | "approved" | "rejected";

export interface LoanApplication {
  id: string;
  type: LoanType;
  lenderName: string;
  amount: number;
  tenureMonths: number;
  applicantName: string;
  applicantEmail: string;
  employmentType: string;
  monthlyIncome: number;
  status: ApplicationStatus;
  submittedAt: string;
}

export interface EligibilityFactor {
  label: string;
  score: number; // 0-100
  level: "Excellent" | "Good" | "Strong" | "Moderate" | "Weak";
}

export interface EligibilityResult {
  eligible: boolean;
  score: number;
  maxEligibleAmount: number;
  recommendedAmount: number;
  recommendedEmi: number;
  dti: number;
  factors: EligibilityFactor[];
}
