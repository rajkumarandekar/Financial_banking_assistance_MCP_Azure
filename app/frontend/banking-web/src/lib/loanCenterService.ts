// Centralized Loans & Lending Center service. Lenders/products/offers and
// EMI/interest/eligibility math are pure functions with no backing service
// (no real multi-lender marketplace exists). Active loans + applications are
// REAL data from loan-service (Postgres, via GraphQL) - pay_emi/
// make_extra_payment/apply_loan mutate the real EMI schedule server-side;
// there is no local/localStorage fallback for these anymore.
import { useMemo } from "react";
import { useLoans } from "@/hooks/useBankingData";
import { bffClient } from "@/api/bffClient";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import type { Loan as BackendLoan } from "@/models/Domain";
import type {
  LoanAccount, Lender, LoanApplication, LoanInstallment, LoanOffer, LoanProduct,
  LoanType, LoanStatus, EligibilityResult, EligibilityFactor,
} from "@/models/LoanCenter";

export const LENDERS: Lender[] = [
  { id: "meridian", name: "SecureBank", rating: 4.8 },
  { id: "hdfc", name: "HDFC Bank", rating: 4.6 },
  { id: "icici", name: "ICICI Bank", rating: 4.5 },
  { id: "axis", name: "Axis Bank", rating: 4.4 },
];

export const LOAN_PRODUCTS: LoanProduct[] = [
  { type: "personal", label: "Personal Loan", description: "For personal expenses", ratesFrom: 10.5, maxAmount: 1_000_000 },
  { type: "auto", label: "Car Loan", description: "Finance a new or used vehicle", ratesFrom: 7.5, maxAmount: 5_000_000 },
  { type: "home", label: "Home Loan", description: "Finance your home", ratesFrom: 8.25, maxAmount: 20_000_000 },
  { type: "education", label: "Education Loan", description: "Fund your education", ratesFrom: 8.0, maxAmount: 2_500_000 },
  { type: "business", label: "Business Loan", description: "Grow your business", ratesFrom: 11.0, maxAmount: 5_000_000 },
];

// Display labels, keyed by the internal LoanType id ("auto" stays the id -
// renaming it would touch every stored loan/application record - only the
// user-facing label changes).
export const LOAN_TYPE_LABEL: Record<LoanType, string> = {
  personal: "Personal Loan", auto: "Car Loan", home: "Home Loan", education: "Education Loan", business: "Business Loan",
};
export const LOAN_TYPE_SHORT_LABEL: Record<LoanType, string> = {
  personal: "Personal", auto: "Car", home: "Home", education: "Education", business: "Business",
};

// Standard amortized EMI: EMI = P * r * (1+r)^n / ((1+r)^n - 1), r = monthly rate.
export function calculateEMI(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

export function calculateTotalInterest(principal: number, annualRatePct: number, months: number): number {
  const emi = calculateEMI(principal, annualRatePct, months);
  return emi * months - principal;
}

export function offersForLoan(amount: number, tenureMonths: number): LoanOffer[] {
  const rateByLender: Record<string, number> = { meridian: 10.5, hdfc: 10.75, icici: 11.0, axis: 11.25 };
  const feeByLender: Record<string, number> = { meridian: 2500, hdfc: 3000, icici: 2750, axis: 2500 };
  return LENDERS.map((l) => ({
    lenderId: l.id,
    lenderName: l.name,
    rating: l.rating,
    aprPct: rateByLender[l.id],
    processingFee: feeByLender[l.id],
  })).map((o) => ({ ...o })).sort((a, b) => a.aprPct - b.aprPct);
}

// --- Active loans (the "My Loans" section) -----------------------------
// loan-service stores each loan's principal/rate/tenure and a flat EMI
// schedule (installment number, due date, amount, paid/pending) - it has no
// stored "outstanding balance" or principal/interest-paid split. Those are
// derived here by walking the same reducing-balance amortization formula
// loan-service itself uses (gql/repository.py's _calculate_emi), for exactly
// as many installments as are marked "paid" server-side.
function deriveLoanMetrics(loan: BackendLoan): LoanAccount | null {
  // Only "active"/"closed" loans are real accounts - "pending"/"rejected"
  // belong in useLoanApplications() instead.
  if (loan.status !== "active" && loan.status !== "closed") return null;

  const schedule = [...(loan.emiSchedule ?? [])].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const paidCount = schedule.filter((e) => e.status === "paid").length;
  const emi = schedule[0]?.amount ?? calculateEMI(loan.principalAmount, loan.interestRate, loan.tenureMonths);

  const r = loan.interestRate / 12 / 100;
  let balance = loan.principalAmount;
  let principalPaid = 0;
  let interestPaid = 0;
  for (let i = 0; i < paidCount; i++) {
    const interest = balance * r;
    const principal = Math.min(emi - interest, balance);
    principalPaid += principal;
    interestPaid += interest;
    balance = Math.max(balance - principal, 0);
  }

  const nextPending = schedule.find((e) => e.status === "pending");
  const lastInstallment = schedule[schedule.length - 1];
  const nextDueDate = nextPending?.dueDate ?? lastInstallment?.dueDate ?? loan.decisionDate ?? loan.appliedDate ?? new Date().toISOString();
  const status: LoanStatus = loan.status === "closed" ? "completed" : "active";

  return {
    id: loan.id,
    type: loan.loanType as LoanType,
    // loan-service has no lender concept - every loan it originates is a
    // direct SecureBank loan (the "compare lenders" marketplace only
    // applies to loans you're about to apply for, not ones you already hold).
    lenderId: "meridian",
    lenderName: "SecureBank",
    principal: loan.principalAmount,
    outstanding: Math.round(balance * 100) / 100,
    interestRateApr: loan.interestRate,
    tenureMonths: loan.tenureMonths,
    remainingMonths: Math.max(loan.tenureMonths - paidCount, 0),
    emi,
    status,
    startDate: loan.decisionDate ?? loan.appliedDate ?? new Date().toISOString(),
    nextDueDate,
    principalPaid: Math.round(principalPaid * 100) / 100,
    interestPaid: Math.round(interestPaid * 100) / 100,
  };
}

export function useLoanAccounts(): LoanAccount[] {
  const { data: rawLoans = [] } = useLoans();
  return useMemo(
    () => rawLoans.map(deriveLoanMetrics).filter((l): l is LoanAccount => l != null),
    [rawLoans]
  );
}

function invalidateLoans() {
  queryClient.invalidateQueries({ queryKey: ["loans"] });
}

/** Generates the next 5 (or full) installment rows for a loan, purely from
 * its current numbers - not a stored schedule. */
export function generateSchedule(loan: LoanAccount, count?: number): LoanInstallment[] {
  const r = loan.interestRateApr / 12 / 100;
  let balance = loan.outstanding;
  const total = count ?? loan.remainingMonths;
  const rows: LoanInstallment[] = [];
  const start = new Date(loan.nextDueDate);
  for (let i = 1; i <= total; i++) {
    const interest = balance * r;
    const principal = Math.min(loan.emi - interest, balance);
    const due = new Date(start);
    due.setMonth(due.getMonth() + (i - 1));
    rows.push({
      installmentNumber: i,
      dueDate: due.toISOString(),
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      amount: Math.round(loan.emi * 100) / 100,
      status: "upcoming",
    });
    balance -= principal;
  }
  return rows;
}

/** Pays the next due installment for real, server-side (loan-service marks
 * it "paid" and closes the loan once every installment is settled). */
export async function payEMI(loanId: string): Promise<LoanAccount | undefined> {
  const updated = await bffClient.payLoanEmi(loanId);
  invalidateLoans();
  return deriveLoanMetrics(updated) ?? undefined;
}

/** Extra payment: pays off as many whole upcoming installments server-side
 * as the amount covers. interestSaved is a client-side estimate (interest
 * that would have accrued on the applied amount over the remaining tenure
 * at the loan's rate) - loan-service's fixed-schedule model doesn't
 * recompute amortization, so this is clearly an estimate, not a ledger figure. */
export async function makeExtraPayment(
  loan: LoanAccount, amount: number
): Promise<{ loan: LoanAccount; interestSaved: number } | undefined> {
  const applied = Math.min(amount, loan.outstanding);
  const r = loan.interestRateApr / 12 / 100;
  const interestSaved = Math.round(applied * r * loan.remainingMonths * 100) / 100;

  const updated = await bffClient.makeLoanExtraPayment(loan.id, amount);
  invalidateLoans();
  const derived = deriveLoanMetrics(updated);
  if (!derived) return undefined;
  return { loan: derived, interestSaved };
}

// --- Eligibility ---------------------------------------------------------
export function calculateEligibility(input: {
  monthlyIncome: number;
  employmentType: string;
  existingMonthlyEmi: number;
  desiredAmount: number;
  loanType: LoanType;
  creditScore: number;
}): EligibilityResult {
  const { monthlyIncome, employmentType, existingMonthlyEmi, desiredAmount, creditScore } = input;

  const dti = monthlyIncome > 0 ? (existingMonthlyEmi / monthlyIncome) * 100 : 100;

  const incomeScore = Math.min(100, Math.round((monthlyIncome / 100_000) * 100));
  const emiBurdenScore = Math.max(0, 100 - dti * 2);
  const creditScoreNorm = Math.max(0, Math.min(100, Math.round(((creditScore - 300) / (850 - 300)) * 100)));
  const employmentScore = employmentType === "Salaried" ? 90 : employmentType === "Self-Employed" ? 70 : 60;

  const factors: EligibilityFactor[] = [
    { label: "Income", score: incomeScore, level: levelFor(incomeScore) },
    { label: "Existing EMIs", score: Math.round(emiBurdenScore), level: levelFor(emiBurdenScore) },
    { label: "Credit Profile", score: creditScoreNorm, level: levelFor(creditScoreNorm) },
    { label: "Debt-to-Income", score: Math.round(100 - dti), level: levelFor(100 - dti) },
  ];

  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length * (employmentScore / 100));

  // Max eligible: a simple affordability rule - up to 50% of monthly income
  // available for EMI, scaled by the overall score, over a typical 60-month
  // horizon at 11% APR (an estimate, not underwriting).
  const affordableEmi = Math.max(monthlyIncome * 0.5 - existingMonthlyEmi, 0) * (overall / 100);
  const maxEligibleAmount = Math.round(principalForEMI(affordableEmi, 11, 60) / 10000) * 10000;

  const recommendedAmount = Math.min(desiredAmount, maxEligibleAmount);
  const recommendedEmi = Math.round(calculateEMI(recommendedAmount, 11, 60));

  return {
    eligible: overall >= 40 && maxEligibleAmount > 0,
    score: overall,
    maxEligibleAmount,
    recommendedAmount,
    recommendedEmi,
    dti: Math.round(dti),
    factors,
  };
}

function levelFor(score: number): EligibilityFactor["level"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good";
  if (score >= 35) return "Moderate";
  return "Weak";
}

/** Inverse of the EMI formula - principal that produces a given EMI. */
function principalForEMI(emi: number, annualRatePct: number, months: number): number {
  if (emi <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return emi * months;
  const factor = Math.pow(1 + r, months);
  return (emi * (factor - 1)) / (r * factor);
}

// --- Applications ---------------------------------------------------------
// A loan is an "application" (not yet an account) for as long as loan-service
// has it at status "pending" or "rejected" - approve_loan jumps straight to
// "active" (see loan/gql/repository.py), so "approved" never actually
// persists, but is handled defensively below in case that changes.
// applicantName/applicantEmail/employmentType/monthlyIncome aren't part of
// loan-service's schema (it only stores the loan terms, not the applicant's
// income statement) - name/email come from the real signed-in profile;
// employment/income genuinely aren't persisted anywhere, so they render as
// "Not provided" rather than a fabricated number.
function deriveApplication(loan: BackendLoan, applicantName: string, applicantEmail: string): LoanApplication | null {
  if (loan.status !== "pending" && loan.status !== "rejected" && loan.status !== "approved") return null;
  const status = loan.status === "pending" ? "under_review" : loan.status === "rejected" ? "rejected" : "approved";
  return {
    id: loan.id,
    type: loan.loanType as LoanType,
    lenderName: "SecureBank",
    amount: loan.principalAmount,
    tenureMonths: loan.tenureMonths,
    applicantName,
    applicantEmail,
    employmentType: "Not provided",
    monthlyIncome: 0,
    status,
    submittedAt: loan.appliedDate ?? new Date().toISOString(),
  };
}

export function useLoanApplications(): LoanApplication[] {
  const { data: rawLoans = [] } = useLoans();
  const { user } = useAuth();
  return useMemo(
    () => rawLoans
      .map((l) => deriveApplication(l, user?.name ?? "You", user?.email ?? ""))
      .filter((a): a is LoanApplication => a != null),
    [rawLoans, user]
  );
}

/** Submits a real loan application against loan-service. loan-service has no
 * concept of a comparison-shopping "lender" for an application in flight -
 * every application is filed with SecureBank directly; lenderName/rate
 * from the offers marketplace are informational only until approval. */
export async function createApplication(input: {
  type: LoanType;
  lenderName: string;
  amount: number;
  tenureMonths: number;
  applicantName: string;
  applicantEmail: string;
  employmentType: string;
  monthlyIncome: number;
}): Promise<LoanApplication> {
  const offer = offersForLoan(input.amount, input.tenureMonths).find((o) => o.lenderName === input.lenderName);
  const created = await bffClient.applyForLoan({
    loanType: input.type,
    principalAmount: input.amount,
    interestRate: offer?.aprPct ?? 11,
    tenureMonths: input.tenureMonths,
  });
  invalidateLoans();
  const record = deriveApplication(created, input.applicantName, input.applicantEmail);
  if (!record) throw new Error("Failed to create loan application");
  return record;
}
