// Credit Card Management Center. Card identity, balance, frozen state,
// security and limit requests are all real account-service data now; only
// offers/rewards/applications-as-a-concept stay local (see
// lib/creditCardService.ts for the scope boundary).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { bffClient } from "@/api/bffClient";
import { useCards } from "@/hooks/useBankingData";
import { CardKpis, CreditHealthSummary } from "@/components/creditCards/CardKpis";
import { MyCreditCards } from "@/components/creditCards/MyCreditCards";
import { CardDetailDrawer } from "@/components/creditCards/CardDetailDrawer";
import { PayCardBillDrawer } from "@/components/creditCards/PayCardBillDrawer";
import { ManageCardDrawer } from "@/components/creditCards/ManageCardDrawer";
import { CardTransactions } from "@/components/creditCards/CardTransactions";
import { CardSpendingAnalytics } from "@/components/creditCards/CardSpendingAnalytics";
import { CardRewards, CardOffers } from "@/components/creditCards/CardRewardsOffers";
import { CardStatements } from "@/components/creditCards/CardStatements";
import { CardApplyDrawer } from "@/components/creditCards/CardApplyDrawer";
import type { CreditCard } from "@/models/CreditCard";
import type { CardOffer } from "@/models/CreditCardCenter";

type EffectiveCard = CreditCard & { frozen: boolean };

export default function CreditCardManagement() {
  const { data: cards = [], isLoading } = useCards();
  const { data: transactions = [] } = useQuery({
    queryKey: ["cardTransactions"],
    queryFn: () => bffClient.getCardTransactions(null),
    staleTime: 60_000,
  });

  const [detailCard, setDetailCard] = useState<EffectiveCard | null>(null);
  const [payCard, setPayCard] = useState<EffectiveCard | null>(null);
  const [manageCard, setManageCard] = useState<EffectiveCard | null>(null);
  const [statementsCard, setStatementsCard] = useState<EffectiveCard | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyOffer, setApplyOffer] = useState<CardOffer | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6 overflow-x-hidden p-4 sm:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[100px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
    );
  }

  const statementsTarget = statementsCard ?? cards[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1600px] animate-fade-in space-y-8 overflow-x-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your cards, spending, payments, rewards and security.</p>
        </div>
        <Button onClick={() => { setApplyOffer(null); setApplyOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />Add / Apply for Card
        </Button>
      </div>

      <CardKpis cards={cards} />
      <CreditHealthSummary cards={cards} />

      <MyCreditCards
        cards={cards}
        onViewDetails={setDetailCard}
        onPayBill={setPayCard}
        onManage={setManageCard}
      />

      <CardSpendingAnalytics transactions={transactions} />

      <CardRewards />
      <CardOffers onApply={(offer) => { setApplyOffer(offer); setApplyOpen(true); }} />

      <CardTransactions transactions={transactions} cards={cards} />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Statement for</span>
        <div className="flex flex-wrap gap-1.5">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setStatementsCard(c)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                statementsTarget?.id === c.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <CardStatements card={statementsTarget} />

      <CardDetailDrawer card={detailCard} onClose={() => setDetailCard(null)} onPayBill={(c) => { setDetailCard(null); setPayCard(c); }} />
      <PayCardBillDrawer card={payCard} onClose={() => setPayCard(null)} onPaid={() => {}} />
      <ManageCardDrawer card={manageCard} onClose={() => setManageCard(null)} />
      <CardApplyDrawer open={applyOpen} preselected={applyOffer} onOpenChange={setApplyOpen} />
    </div>
  );
}
