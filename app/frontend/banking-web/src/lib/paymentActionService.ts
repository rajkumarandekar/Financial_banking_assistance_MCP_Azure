// Payments (New Payment / Pay a Bill) service. "Pay now" genuinely executes
// against real payment-service (create + notify transaction-service + mark
// paid/failed, all server-side) - no more localStorage simulation, no fake
// processing delay or random failure rate. "Schedule for later" has no real
// backend equivalent (no service in this system supports deferred/cron
// execution), so scheduled drafts stay local-only, clearly a smaller,
// separate slice of state from the real payment history.
import { useMemo, useSyncExternalStore } from "react";
import { bffClient } from "@/api/bffClient";
import { queryClient } from "@/lib/queryClient";
import { usePaymentActionRecords } from "@/hooks/useBankingData";
import { mockEmailService } from "@/lib/mockEmailService";
import type { PaymentRecord } from "@/models/Domain";
import type { PaymentAction, PaymentActionStatus, PaymentActionType } from "@/models/PaymentAction";
import { BILL_CATEGORIES } from "@/models/PaymentAction";

const RECEIPT_EMAIL = "bob.user@contoso.com";

const BILL_CATEGORY_LABELS = new Set(BILL_CATEGORIES.map((c) => c.label));

function mapStatus(backendStatus: string): PaymentActionStatus {
  if (backendStatus === "paid") return "paid";
  if (backendStatus === "failed") return "failed";
  if (backendStatus === "cancelled") return "cancelled";
  return "pending"; // "processing" | "pending"
}

/** General-purpose mapper for records fetched from the list query - no
 * original form input is available here, so bill-only fields not modeled
 * server-side (customerId - the account number *you* have with the biller)
 * can't be reconstructed and are left undefined. type/billerName are
 * inferred from category, since payment-service has no person/bill
 * distinction of its own. */
function mapRecordToAction(record: PaymentRecord): PaymentAction {
  const isBill = record.category ? BILL_CATEGORY_LABELS.has(record.category) : false;
  const status = mapStatus(record.status);
  return {
    id: record.id,
    type: isBill ? "bill" : "person",
    recipientName: isBill ? undefined : record.recipientName ?? undefined,
    billerName: isBill ? record.recipientName ?? undefined : undefined,
    category: record.category ?? undefined,
    amount: record.amount,
    status,
    paymentMethod: record.paymentType ?? "Primary Bank Account",
    createdAt: record.createdAt ?? new Date().toISOString(),
    paidAt: status === "paid" ? record.createdAt ?? undefined : undefined,
    transactionId: record.transactionId ?? undefined,
    failureReason: record.failureReason ?? undefined,
  };
}

/** Any real payment mutation writes to payment-service AND notifies
 * transaction-service (see submitPayment/retryPaymentAction/
 * cancelPaymentAction in bffClient.ts) - so every query key reading either
 * of those needs to be invalidated together, not just paymentActions.
 * Previously only paymentActions was invalidated, so the Payments page's own
 * KPIs/table (["payments"]) and Dashboard/Analytics (["transactions"]) stayed
 * stale until their 60s staleTime lapsed on its own. */
function invalidatePaymentActions() {
  queryClient.invalidateQueries({ queryKey: ["paymentActions"] });
  queryClient.invalidateQueries({ queryKey: ["payments"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

// --- Scheduled ("pay later") drafts - local-only, no backend equivalent ---
const SCHEDULED_KEY = "meridian_scheduled_payments_v1";
let scheduled: PaymentAction[] = loadScheduled();
const scheduledListeners = new Set<() => void>();

function loadScheduled(): PaymentAction[] {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY);
    return raw ? (JSON.parse(raw) as PaymentAction[]) : [];
  } catch {
    return [];
  }
}

function persistScheduled() {
  try { localStorage.setItem(SCHEDULED_KEY, JSON.stringify(scheduled)); } catch { /* best-effort */ }
}

function emitScheduled() {
  persistScheduled();
  scheduledListeners.forEach((l) => l());
}

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function useScheduledDrafts(): PaymentAction[] {
  return useSyncExternalStore(
    (l) => { scheduledListeners.add(l); return () => scheduledListeners.delete(l); },
    () => scheduled,
    () => scheduled
  );
}

export interface CreatePersonPaymentInput {
  recipientName: string;
  recipientEmail?: string;
  amount: number;
  paymentMethod: string;
  scheduleDate: string | null; // null = pay now
  note?: string;
}

export interface CreateBillPaymentInput {
  billerName: string;
  category: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  dueDate?: string;
  scheduleDate: string | null; // null = pay now
}

function baseDraft(type: PaymentActionType, common: Partial<PaymentAction>): PaymentAction {
  return {
    id: genId("sched"),
    type,
    status: "upcoming",
    amount: 0,
    paymentMethod: "Primary Bank Account",
    createdAt: new Date().toISOString(),
    ...common,
  };
}

function scheduleForLater(input: CreatePersonPaymentInput | CreateBillPaymentInput): PaymentAction {
  const record = "recipientName" in input
    ? baseDraft("person", {
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        dueDate: input.scheduleDate ?? undefined,
        note: input.note,
      })
    : baseDraft("bill", {
        billerName: input.billerName,
        category: input.category,
        customerId: input.customerId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        dueDate: input.scheduleDate ?? input.dueDate,
      });
  scheduled = [record, ...scheduled];
  emitScheduled();
  return record;
}

/** Pays a person now - one real backend call that creates and executes the
 * payment atomically. Display-only fields with no backend representation
 * (recipientEmail, note) are merged in from the original input rather than
 * round-tripped through the server. */
async function payPerson(input: CreatePersonPaymentInput): Promise<PaymentAction> {
  const created = await bffClient.submitPayment({
    description: input.note?.trim() || `Payment to ${input.recipientName}`,
    amount: input.amount,
    recipientName: input.recipientName,
    paymentType: input.paymentMethod.toLowerCase().includes("card") ? "CreditCard" : "BankTransfer",
    category: "Transfer",
  });
  invalidatePaymentActions();
  const result: PaymentAction = {
    ...mapRecordToAction(created),
    type: "person",
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    paymentMethod: input.paymentMethod,
    note: input.note,
  };
  if (result.status === "paid") {
    mockEmailService.sendReceipt(RECEIPT_EMAIL, `Payment receipt - ${input.recipientName} - ${result.transactionId}`);
  }
  return result;
}

/** Pays a bill now - same atomic real backend call. customerId ("your"
 * account number with the biller) has no backend field, so it's merged in
 * from the input for this immediate result; it won't survive a page reload
 * for older payments (see mapRecordToAction's comment). */
async function payBill(input: CreateBillPaymentInput): Promise<PaymentAction> {
  const created = await bffClient.submitPayment({
    description: `${input.billerName} - Customer ${input.customerId}`,
    amount: input.amount,
    recipientName: input.billerName,
    paymentType: "BankTransfer",
    category: input.category,
  });
  invalidatePaymentActions();
  const result: PaymentAction = {
    ...mapRecordToAction(created),
    type: "bill",
    billerName: input.billerName,
    category: input.category,
    customerId: input.customerId,
    paymentMethod: input.paymentMethod,
    dueDate: input.dueDate,
  };
  if (result.status === "paid") {
    mockEmailService.sendReceipt(RECEIPT_EMAIL, `Payment receipt - ${input.billerName} - ${result.transactionId}`);
  }
  return result;
}

/** Creates the payment - "pay now" executes for real immediately;
 * "schedule for later" stays a local-only draft. Always async so callers
 * don't need to branch on which path was taken. */
async function createPersonPayment(input: CreatePersonPaymentInput): Promise<PaymentAction> {
  return input.scheduleDate != null ? scheduleForLater(input) : payPerson(input);
}

async function createBillPayment(input: CreateBillPaymentInput): Promise<PaymentAction> {
  return input.scheduleDate != null ? scheduleForLater(input) : payBill(input);
}

async function retryPayment(id: string): Promise<PaymentAction> {
  const updated = await bffClient.retryPaymentAction(id);
  invalidatePaymentActions();
  return mapRecordToAction(updated);
}

async function cancelPayment(id: string): Promise<PaymentAction> {
  // A scheduled (never-submitted) draft just gets removed locally - there's
  // no backend row for it to cancel.
  const draft = scheduled.find((p) => p.id === id);
  if (draft) {
    scheduled = scheduled.filter((p) => p.id !== id);
    emitScheduled();
    return { ...draft, status: "cancelled" };
  }
  const updated = await bffClient.cancelPaymentAction(id);
  invalidatePaymentActions();
  return mapRecordToAction(updated);
}

export const paymentActionService = {
  createPersonPayment,
  createBillPayment,
  payPerson,
  payBill,
  retryPayment,
  cancelPayment,
};

// --- React binding -------------------------------------------------------
export function usePaymentActions(): PaymentAction[] {
  const { data: records = [] } = usePaymentActionRecords();
  const drafts = useScheduledDrafts();
  return useMemo(() => [...records.map(mapRecordToAction), ...drafts], [records, drafts]);
}
