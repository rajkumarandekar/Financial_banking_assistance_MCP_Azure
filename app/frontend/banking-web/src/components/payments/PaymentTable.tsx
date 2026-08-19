// The core payment management surface: filter tabs, search, a desktop table
// that becomes compact cards on mobile, and pagination. Filter state is
// controlled from the page so the KPI cards ("View pending", "View upcoming")
// can jump straight to the relevant tab instead of just being static links.
import { useEffect, useMemo, useState } from "react";
import {
  Search, Filter, ChevronLeft, ChevronRight, MoreVertical,
  Zap, Wifi, Droplet, Smartphone, CreditCard as CreditCardIcon, Landmark, Receipt,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { normalizeStatus, splitDescription, STATUS_LABEL, type PaymentStatus } from "@/lib/payments";
import { formatINR } from "@/lib/chartTokens";
import type { Payment } from "@/models/Payments";

export type TableFilter = "all" | PaymentStatus;
const FILTERS: { value: TableFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

const PAGE_SIZE = 5;

const STATUS_BADGE: Record<PaymentStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-border bg-muted text-muted-foreground",
};

const STATUS_DOT: Record<PaymentStatus, string> = {
  pending: "bg-amber-500", paid: "bg-green-500", failed: "bg-rose-500", cancelled: "bg-muted-foreground",
};

/** Best-effort icon from category/paymentType/description - purely cosmetic,
 * never used to infer real payment semantics. */
function paymentIcon(p: Payment) {
  const hint = `${p.category ?? ""} ${p.paymentType ?? ""} ${p.description}`.toLowerCase();
  if (hint.includes("electric")) return Zap;
  if (hint.includes("internet") || hint.includes("wifi")) return Wifi;
  if (hint.includes("water") || hint.includes("gas")) return Droplet;
  if (hint.includes("mobile") || hint.includes("phone")) return Smartphone;
  if (hint.includes("card")) return CreditCardIcon;
  if (hint.includes("loan")) return Landmark;
  return Receipt;
}

interface PaymentTableProps {
  payments: Payment[];
  filter: TableFilter;
  onFilterChange: (f: TableFilter) => void;
  onSelect: (payment: Payment) => void;
  onPayNow: (payment: Payment) => void;
}

export function PaymentTable({ payments, filter, onFilterChange, onSelect, onPayNow }: PaymentTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return payments
      .filter((p) => filter === "all" || normalizeStatus(p.status) === filter)
      .filter((p) => {
        if (!needle) return true;
        return (
          p.description.toLowerCase().includes(needle) ||
          (p.recipientName ?? "").toLowerCase().includes(needle) ||
          String(p.amount).includes(needle)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [payments, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(0), [filter, search]);
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const counts = useMemo(() => {
    const c: Record<TableFilter, number> = { all: payments.length, pending: 0, paid: 0, failed: 0, cancelled: 0 };
    for (const p of payments) c[normalizeStatus(p.status)] += 1;
    return c;
  }, [payments]);

  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">All Payments</h3>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter payments by status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                aria-pressed={filter === f.value}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label} <span className="tabular-nums opacity-70">({counts[f.value]})</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payments by name, biller, amount..."
              className="pl-8 pr-8 text-sm"
              aria-label="Search payments"
            />
            <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        {paged.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              {filter === "all" ? "No payments found" : `No ${STATUS_LABEL[filter as PaymentStatus].toLowerCase()} payments`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? "Try a different search term." : "You're all caught up."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-4 hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Payment</th>
                    <th className="pb-2 pr-3 font-medium">Biller / Reference</th>
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 text-right font-medium">Amount</th>
                    <th className="pb-2 pr-3 text-right font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => {
                    const status = normalizeStatus(p.status);
                    const { name, reference } = splitDescription(p.description);
                    const Icon = paymentIcon(p);
                    return (
                      <tr key={p.id} className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                        onClick={() => onSelect(p)}>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="font-medium text-foreground">{name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          <div>{p.recipientName || "—"}</div>
                          {reference && <div className="text-xs">{reference}</div>}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {new Date(p.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="py-3 pr-3 text-right font-semibold tabular-nums text-foreground">{formatINR(p.amount)}</td>
                        <td className="py-3 pr-3 text-right">
                          <Badge variant="outline" className={`gap-1 text-[10px] ${STATUS_BADGE[status]}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />{STATUS_LABEL[status]}
                          </Badge>
                        </td>
                        <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {status === "pending" && (
                              <Button size="sm" className="h-7 text-xs" onClick={() => onPayNow(p)}>Pay Now</Button>
                            )}
                            {status === "paid" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSelect(p)}>Receipt</Button>
                            )}
                            {status === "failed" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600 hover:text-rose-600" onClick={() => onPayNow(p)}>Retry</Button>
                            )}
                            <RowMenu payment={p} status={status} onSelect={onSelect} onPayNow={onPayNow} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="mt-4 space-y-2 sm:hidden">
              {paged.map((p) => {
                const status = normalizeStatus(p.status);
                const { name, reference } = splitDescription(p.description);
                const Icon = paymentIcon(p);
                return (
                  <li key={p.id}>
                    {/* A <button> can't legally contain the "Pay Now" <button>
                        below, so this is a div with button semantics instead -
                        nesting real buttons breaks the outer one's click
                        handling (the browser auto-closes it at the nested tag). */}
                    <div
                      role="button" tabIndex={0}
                      onClick={() => onSelect(p)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(p)}
                      className="w-full cursor-pointer rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.recipientName}{reference ? ` · ${reference}` : ""}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums text-foreground">{formatINR(p.amount)}</p>
                          <Badge variant="outline" className={`mt-1 gap-1 text-[10px] ${STATUS_BADGE[status]}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />{STATUS_LABEL[status]}
                          </Badge>
                        </div>
                      </div>
                      {status === "pending" && (
                        <Button size="sm" className="mt-2 h-7 w-full text-xs" onClick={(e) => { e.stopPropagation(); onPayNow(p); }}>Pay Now</Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {filtered.length > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <p className="text-xs text-muted-foreground">
                  Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} payments
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <Button key={i} variant={i === safePage ? "default" : "outline"} size="icon" className="h-8 w-8 text-xs"
                      onClick={() => setPage(i)} aria-label={`Page ${i + 1}`} aria-current={i === safePage}>
                      {i + 1}
                    </Button>
                  ))}
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RowMenu({ payment, status, onSelect, onPayNow }: {
  payment: Payment;
  status: PaymentStatus;
  onSelect: (p: Payment) => void;
  onPayNow: (p: Payment) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white">
        <DropdownMenuItem onClick={() => onSelect(payment)}>View details</DropdownMenuItem>
        {status === "paid" && <DropdownMenuItem onClick={() => onSelect(payment)}>Download receipt</DropdownMenuItem>}
        {status === "pending" && (
          <>
            <DropdownMenuItem onClick={() => onPayNow(payment)}>Set reminder</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-600 focus:text-rose-600">Cancel payment</DropdownMenuItem>
          </>
        )}
        {status === "failed" && <DropdownMenuItem onClick={() => onPayNow(payment)}>Retry payment</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
