import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { minimumPayment, nextDueDate, utilizationLevel } from "@/lib/creditCardService";
import type { CreditCard, CreditCardStatus } from "@/models/CreditCard";

type EffectiveCard = CreditCard & { frozen: boolean };

const STATUS_BADGE: Record<CreditCardStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  expired: "border-border bg-muted text-muted-foreground",
  closed: "border-border bg-muted text-muted-foreground",
};

const THRESHOLDS = [
  { label: "Healthy", range: "0–30%", color: "#16a34a" },
  { label: "Moderate", range: "30–50%", color: "#f59e0b" },
  { label: "High", range: "50%+", color: "#dc2626" },
];

interface CardDetailDrawerProps {
  card: EffectiveCard | null;
  onClose: () => void;
  onPayBill: (card: EffectiveCard) => void;
}

export function CardDetailDrawer({ card, onClose, onPayBill }: CardDetailDrawerProps) {
  return (
    <Sheet open={card != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-card sm:max-w-lg overflow-y-auto">
        {card && (() => {
          const utilization = card.limit > 0 ? (card.balance / card.limit) * 100 : 0;
          const available = Math.max(card.limit - card.balance, 0);
          const level = utilizationLevel(utilization);
          const minDue = minimumPayment(card.balance);
          const due = nextDueDate();

          return (
            <>
              <SheetHeader>
                <SheetTitle>{card.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">•••• {card.number.slice(-4)}</p>
                <Badge variant="outline" className={STATUS_BADGE[card.status]}>● {card.frozen ? "Frozen" : card.status[0].toUpperCase() + card.status.slice(1)}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <Stat label="Current Balance" value={`₹${card.balance.toLocaleString()}`} />
                <Stat label="Available Credit" value={`₹${available.toLocaleString()}`} />
                <Stat label="Credit Limit" value={`₹${card.limit.toLocaleString()}`} />
                <Stat label="Minimum Payment" value={`₹${minDue.toLocaleString()}`} />
                <Stat label="Payment Due" value={new Date(due).toLocaleDateString(undefined, { dateStyle: "medium" })} />
                <Stat label="Statement Balance" value={`₹${card.balance.toLocaleString()}`} />
              </div>

              <div className="mt-6 border-t border-border/60 pt-4">
                <h3 className="text-sm font-semibold text-foreground">Credit Utilization</h3>
                <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: level.color }}>{utilization.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">₹{card.balance.toLocaleString()} used · ₹{available.toLocaleString()} available · ₹{card.limit.toLocaleString()} limit</p>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(utilization, 100)}%`, backgroundColor: level.color }} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {THRESHOLDS.map((t) => (
                    <div key={t.label} className="flex flex-col items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-[10px] font-medium text-foreground">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground">{t.range}</span>
                    </div>
                  ))}
                </div>
              </div>

              {card.status === "active" && (
                <Button className="mt-6 w-full" onClick={() => onPayBill(card)}>Pay Bill</Button>
              )}
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
