import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Plane, Fuel, Crown, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CARD_OFFERS, CARD_REWARDS } from "@/lib/creditCardService";
import type { CardOffer } from "@/models/CreditCardCenter";

// Per-offer accent so the grid reads as distinct products rather than a
// wall of identical primary-tinted cards.
const OFFER_STYLE: Record<string, { icon: typeof Gift; iconBg: string; iconColor: string; ring: string; badge: string }> = {
  "travel-platinum": { icon: Plane, iconBg: "bg-blue-500/10", iconColor: "text-blue-600", ring: "hover:border-blue-400/60", badge: "border-blue-400/40 text-blue-600 bg-blue-500/5" },
  cashback: { icon: Wallet, iconBg: "bg-green-500/10", iconColor: "text-green-600", ring: "hover:border-green-400/60", badge: "border-green-400/40 text-green-600 bg-green-500/5" },
  fuel: { icon: Fuel, iconBg: "bg-orange-500/10", iconColor: "text-orange-600", ring: "hover:border-orange-400/60", badge: "border-orange-400/40 text-orange-600 bg-orange-500/5" },
  "executive-elite": { icon: Crown, iconBg: "bg-purple-500/10", iconColor: "text-purple-600", ring: "hover:border-purple-400/60", badge: "border-purple-400/40 text-purple-600 bg-purple-500/5" },
};
const DEFAULT_OFFER_STYLE = { icon: Gift, iconBg: "bg-primary/10", iconColor: "text-primary", ring: "hover:border-primary/50", badge: "border-border/60 text-muted-foreground" };

// A single horizontal strip rather than a narrow tall column - pairing it
// with the taller, grid-based Offers section in a 2-col layout left a lot
// of dead whitespace under this card, so both are now full-width, stacked
// sections instead.
export function CardRewards() {
  const { toast } = useToast();
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Rewards</h3>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-2xl font-bold text-foreground tabular-nums">{CARD_REWARDS.points.toLocaleString()} points</p>
            <p className="text-xs text-muted-foreground">Estimated value ₹{CARD_REWARDS.estimatedValue.toLocaleString()}</p>
            <p className="text-xs font-medium text-green-600">+{CARD_REWARDS.pointsThisMonth} this month</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {["Cashback", "Travel", "Gift Cards", "Shopping"].map((c) => (
              <span key={c} className="rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground">{c}</span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => toast({ title: "✓ Rewards Redeemed" })}>
            Redeem Rewards
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast({ title: "Rewards history", description: "820 pts this month · 1,240 pts last month" })}>
            View History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const CATEGORIES: CardOffer["category"][] = ["Cashback", "Travel", "Premium"];

export function CardOffers({ onApply }: { onApply: (offer: CardOffer) => void }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">Recommended Card Offers</h2>
      <div className="mt-1 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <span key={c} className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">{c}</span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARD_OFFERS.map((o) => {
          const style = OFFER_STYLE[o.id] ?? DEFAULT_OFFER_STYLE;
          const Icon = style.icon;
          return (
            <Card key={o.id} className={`min-w-0 bg-card/50 backdrop-blur border-border/50 transition-colors ${style.ring}`}>
              <CardContent className="p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${style.iconBg} ${style.iconColor}`}><Icon className="h-4 w-4" /></span>
                <p className="mt-2 text-sm font-semibold text-foreground">{o.name}</p>
                <p className="text-xs text-muted-foreground">{o.headline}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-muted-foreground">Annual Fee</p>
                    <p className="font-medium text-foreground">₹{o.annualFee.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Credit Limit</p>
                    <p className="font-medium text-foreground">{o.creditLimit}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`mt-2 text-[10px] ${style.badge}`}>{o.category}</Badge>
                <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => onApply(o)}>View Offer</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
