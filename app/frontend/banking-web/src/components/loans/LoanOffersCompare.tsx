// Marketplace-style lender comparison, reused on both the main Loans page
// (default Personal Loan scenario) and the dedicated Explore screen
// (parameterized by the chosen category/amount/tenure).
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { offersForLoan, calculateEMI, calculateTotalInterest, LOAN_TYPE_LABEL } from "@/lib/loanCenterService";
import type { LoanOffer, LoanType } from "@/models/LoanCenter";

interface LoanOffersCompareProps {
  loanType: LoanType;
  amount: number;
  tenureMonths: number;
  onApply: (offer: LoanOffer) => void;
}

export function LoanOffersCompare({ loanType, amount, tenureMonths, onApply }: LoanOffersCompareProps) {
  const offers = offersForLoan(amount, tenureMonths);
  const [selected, setSelected] = useState<string[]>([]);
  const bestApr = Math.min(...offers.map((o) => o.aprPct));

  const toggleCompare = (lenderId: string) => {
    setSelected((s) => (s.includes(lenderId) ? s.filter((id) => id !== lenderId) : s.length < 3 ? [...s, lenderId] : s));
  };

  const compared = offers.filter((o) => selected.includes(o.lenderId));

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">Loan Offers</h2>
      <p className="text-xs text-muted-foreground">
        Compare offers from multiple lenders — {LOAN_TYPE_LABEL[loanType]} · ₹{amount.toLocaleString()} · {tenureMonths} months
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {offers.map((o) => {
          const emi = calculateEMI(amount, o.aprPct, tenureMonths);
          const isBest = o.aprPct === bestApr;
          return (
            <Card key={o.lenderId} className={`bg-card/50 backdrop-blur ${isBest ? "border-primary" : "border-border/50"}`}>
              <CardContent className="p-4">
                {isBest && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">Best value</p>}
                <p className="text-sm font-semibold text-foreground">{o.lenderName}</p>
                <p className="mt-2 text-lg font-bold text-foreground tabular-nums">{o.aprPct.toFixed(2)}% <span className="text-xs font-normal text-muted-foreground">APR</span></p>
                <p className="text-xs text-muted-foreground">EMI ₹{Math.round(emi).toLocaleString()}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Processing Fee ₹{o.processingFee.toLocaleString()}</p>
                <div className="mt-1 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < Math.round(o.rating) ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => toggleCompare(o.lenderId)}>
                    {selected.includes(o.lenderId) ? "Remove" : "Compare"}
                  </Button>
                  <Button size="sm" className="flex-1 text-xs" onClick={() => onApply(o)}>Apply</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {compared.length >= 2 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="p-3 text-left text-xs font-medium text-muted-foreground">Compare Offers</th>
                {compared.map((o) => (
                  <th key={o.lenderId} className={`p-3 text-left text-xs font-semibold ${o.aprPct === bestApr ? "text-primary" : "text-foreground"}`}>{o.lenderName}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <CompareRow label="Interest" cells={compared.map((o) => `${o.aprPct.toFixed(2)}%`)} />
              <CompareRow label="EMI" cells={compared.map((o) => `₹${Math.round(calculateEMI(amount, o.aprPct, tenureMonths)).toLocaleString()}`)} />
              <CompareRow label="Processing Fee" cells={compared.map((o) => `₹${o.processingFee.toLocaleString()}`)} />
              <CompareRow label="Tenure" cells={compared.map(() => `${tenureMonths} months`)} />
              <CompareRow label="Total Interest" cells={compared.map((o) => `₹${Math.round(calculateTotalInterest(amount, o.aprPct, tenureMonths)).toLocaleString()}`)} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <td className="p-3 text-xs text-muted-foreground">{label}</td>
      {cells.map((c, i) => <td key={i} className="p-3 text-sm font-medium text-foreground">{c}</td>)}
    </tr>
  );
}
