import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCardVisual } from "@/components/CreditCardVisual";
import { useToast } from "@/hooks/use-toast";
import { freezeCard, unfreezeCard, unblockCard, closeCard } from "@/lib/creditCardService";
import type { CreditCard, CreditCardStatus, CreditCardCircuit } from "@/models/CreditCard";

type EffectiveCard = CreditCard & { frozen: boolean };
type Filter = "all" | "active" | "blocked" | "expired" | "closed";

const STATUS_BADGE: Record<CreditCardStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  expired: "border-border bg-muted text-muted-foreground",
  closed: "border-border bg-muted text-muted-foreground",
};

const NETWORK_LABEL: Record<CreditCardCircuit, string> = {
  visa: "VISA", mastercard: "Mastercard", amex: "AMEX",
};

interface MyCreditCardsProps {
  cards: EffectiveCard[];
  onViewDetails: (card: EffectiveCard) => void;
  onPayBill: (card: EffectiveCard) => void;
  onManage: (card: EffectiveCard) => void;
}

export function MyCreditCards({ cards, onViewDetails, onPayBill, onManage }: MyCreditCardsProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [freezeTarget, setFreezeTarget] = useState<EffectiveCard | null>(null);
  const [closeTarget, setCloseTarget] = useState<EffectiveCard | null>(null);

  const visible = filter === "all" ? cards : cards.filter((c) => c.status === filter);

  const confirmFreeze = async () => {
    if (!freezeTarget) return;
    const target = freezeTarget;
    setFreezeTarget(null);
    try {
      await freezeCard(target.id);
      toast({ title: "✓ Card Frozen", description: `${target.name} is temporarily locked.` });
    } catch {
      toast({ title: "Couldn't freeze card", description: "Please try again." });
    }
  };

  const handleUnfreeze = async (card: EffectiveCard) => {
    try {
      await unfreezeCard(card.id);
      toast({ title: "✓ Card Unfrozen", description: `${card.name} is active again.` });
    } catch {
      toast({ title: "Couldn't unfreeze card", description: "Please try again." });
    }
  };

  const handleUnblock = async (card: EffectiveCard) => {
    try {
      await unblockCard(card.id);
      toast({ title: "✓ Card Unblocked", description: `${card.name} is active again.` });
    } catch {
      toast({ title: "Couldn't unblock card", description: "Please try again." });
    }
  };

  const confirmClose = async () => {
    if (!closeTarget) return;
    const target = closeTarget;
    setCloseTarget(null);
    try {
      await closeCard(target.id);
      toast({ title: "✓ Card Closed", description: `${target.name} has been permanently closed.` });
    } catch (err) {
      toast({
        title: "Couldn't close card",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">My Credit Cards</h2>
        <div className="flex rounded-lg border border-border/60 p-0.5">
          {(["all", "active", "blocked", "expired", "closed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All Cards" : f}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground py-6 text-center">No cards in this category.</p>
      ) : (
        <Carousel opts={{ align: "start" }} className="mt-4 w-full">
          {visible.length > 2 && (
            <div className="mb-2 flex justify-end gap-1">
              <CarouselPrevious className="static h-7 w-7 translate-y-0" />
              <CarouselNext className="static h-7 w-7 translate-y-0" />
            </div>
          )}
          <CarouselContent>
            {visible.map((card) => {
              const utilization = card.limit > 0 ? (card.balance / card.limit) * 100 : 0;
              const available = Math.max(card.limit - card.balance, 0);
              return (
                <CarouselItem key={card.id} className="md:basis-1/2 lg:basis-1/3">
                  <Card className="min-w-0 h-full bg-card/50 backdrop-blur border-border/50">
                    <CardContent className="p-4 space-y-3">
                      <CreditCardVisual card={card} />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{card.name}</p>
                          <Badge variant="outline" className="shrink-0 text-[9px] font-semibold tracking-wide">{NETWORK_LABEL[card.circuit]}</Badge>
                        </div>
                        <Badge variant="outline" className={`shrink-0 ${STATUS_BADGE[card.status]}`}>
                          ● {card.frozen ? "Frozen" : card.status[0].toUpperCase() + card.status.slice(1)}
                        </Badge>
                      </div>

                      {card.status !== "blocked" && card.status !== "closed" && (
                        <>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Current Balance</p>
                              <p className="font-semibold text-foreground">₹{card.balance.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-muted-foreground">Credit Limit</p>
                              <p className="font-semibold text-foreground">₹{card.limit.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Available</p>
                              <p className="font-medium text-foreground">₹{available.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-muted-foreground">{utilization.toFixed(1)}% used</p>
                            </div>
                          </div>
                          <Progress value={utilization} className="h-1.5" />
                        </>
                      )}
                      {card.status === "blocked" && (
                        <p className="text-xs text-muted-foreground">This card is blocked. Balance ₹{card.balance.toLocaleString()} · Limit ₹{card.limit.toLocaleString()}</p>
                      )}
                      {card.status === "closed" && (
                        <p className="text-xs text-muted-foreground">This card is permanently closed and no longer counts toward your credit totals.</p>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => onViewDetails(card)}>View Details</Button>
                        {card.status === "active" && (
                          <>
                            <Button size="sm" onClick={() => onPayBill(card)}>Pay Bill</Button>
                            {card.frozen ? (
                              <Button size="sm" variant="outline" onClick={() => handleUnfreeze(card)}>Unfreeze</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setFreezeTarget(card)}>Freeze</Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => onManage(card)}>Manage</Button>
                            <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setCloseTarget(card)}>
                              Close Card
                            </Button>
                          </>
                        )}
                        {card.status === "blocked" && (
                          <Button size="sm" variant="outline" onClick={() => handleUnblock(card)}>Unblock Card</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      )}

      <AlertDialog open={freezeTarget != null} onOpenChange={(o) => !o && setFreezeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Freeze {freezeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Freezing temporarily prevents new transactions. You can unfreeze anytime.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFreeze}>Freeze Card</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeTarget != null} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {closeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently closes the card - it cannot be reopened. Your credit limit and balance for this card
              will no longer count toward your totals anywhere.
              {closeTarget && closeTarget.balance > 0 && (
                <span className="mt-2 block font-medium text-rose-600">
                  This card has an outstanding balance of ₹{closeTarget.balance.toLocaleString()} - pay it off first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-rose-600 hover:bg-rose-700">
              Close Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
