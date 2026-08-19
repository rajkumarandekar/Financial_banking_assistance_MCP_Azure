// "Manage" drawer: security toggles + spending-limit increase request.
// Every change is a local-state update confirmed with a toast.
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCardSecurity, updateSecuritySettings, requestLimitIncrease } from "@/lib/creditCardService";
import type { CardSecuritySettings } from "@/models/CreditCardCenter";
import type { CreditCard } from "@/models/CreditCard";

type EffectiveCard = CreditCard & { frozen: boolean };

const TOGGLES: { key: keyof CardSecuritySettings; label: string; on: string; off: string }[] = [
  { key: "onlineTransactions", label: "Online Transactions", on: "Online transactions enabled", off: "Online transactions disabled" },
  { key: "internationalTransactions", label: "International Transactions", on: "International transactions enabled", off: "International transactions disabled" },
  { key: "contactlessPayments", label: "Contactless Payments", on: "Contactless payments enabled", off: "Contactless payments disabled" },
  { key: "atmWithdrawals", label: "ATM Withdrawals", on: "ATM withdrawals enabled", off: "ATM withdrawals disabled" },
];

export function ManageCardDrawer({ card, onClose }: { card: EffectiveCard | null; onClose: () => void }) {
  const { toast } = useToast();
  const security = useCardSecurity(card?.id ?? null);
  const [requestedLimit, setRequestedLimit] = useState<number | null>(null);

  if (!card) return <Sheet open={false} onOpenChange={() => onClose()}><SheetContent /></Sheet>;

  const maxIncrease = Math.round((card.limit * 1.33) / 10000) * 10000;
  const sliderValue = requestedLimit ?? card.limit;

  const toggle = async (key: keyof CardSecuritySettings, on: string, off: string) => {
    const next = !security[key];
    try {
      await updateSecuritySettings(card.id, { [key]: next } as Partial<CardSecuritySettings>);
      toast({ title: `✓ ${next ? on : off}` });
    } catch {
      toast({ title: "Couldn't update setting", description: "Please try again." });
    }
  };

  const submitLimitRequest = async () => {
    try {
      const req = await requestLimitIncrease(card.id, card.limit, sliderValue);
      toast({ title: "✓ Request Submitted", description: `Request ID: ${req.id} · Status: Under Review` });
      setRequestedLimit(null);
    } catch {
      toast({ title: "Couldn't submit request", description: "Please try again." });
    }
  };

  return (
    <Sheet open={card != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-card sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage {card.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground">Card Security</h3>
          <div className="mt-3 space-y-3">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{t.label}</span>
                <Switch checked={Boolean(security[t.key])} onCheckedChange={() => toggle(t.key, t.on, t.off)} />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Transaction Limit</p>
              <p className="font-medium text-foreground">₹{security.dailyTransactionLimit.toLocaleString()}/day</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Online Limit</p>
              <p className="font-medium text-foreground">₹{security.dailyOnlineLimit.toLocaleString()}/day</p>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border/60 pt-4">
          <h3 className="text-sm font-semibold text-foreground">Manage Spending Limit</h3>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Limit</span>
            <span className="font-medium text-foreground">₹{card.limit.toLocaleString()}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Available to increase up to ₹{maxIncrease.toLocaleString()}</p>
          <Slider className="mt-3" value={[sliderValue]} min={card.limit} max={maxIncrease} step={10000} onValueChange={([v]) => setRequestedLimit(v)} />
          <p className="mt-1 text-sm font-semibold text-foreground">₹{sliderValue.toLocaleString()}</p>
          <Button className="mt-3 w-full" variant="outline" disabled={sliderValue <= card.limit} onClick={submitLimitRequest}>
            Request Limit Change
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
