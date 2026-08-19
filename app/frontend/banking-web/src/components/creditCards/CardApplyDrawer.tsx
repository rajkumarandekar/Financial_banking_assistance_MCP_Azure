// "Add / Apply for Card" marketplace + a simplified application flow
// (details -> review -> submit -> success with a timeline). Runs on local
// application state - not wired to a real card issuer.
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard as CardIcon } from "lucide-react";
import { CARD_OFFERS, applyForCard, issueCard } from "@/lib/creditCardService";
import type { CardOffer, CardApplication } from "@/models/CreditCardCenter";
import type { CreditCard } from "@/models/CreditCard";

type Phase = "select" | "details" | "review" | "success";
const CATEGORIES: (CardOffer["category"] | "All")[] = ["All", "Cashback", "Travel", "Premium"];

interface CardApplyDrawerProps {
  open: boolean;
  preselected?: CardOffer | null;
  onOpenChange: (open: boolean) => void;
}

export function CardApplyDrawer({ open, preselected, onOpenChange }: CardApplyDrawerProps) {
  const [phase, setPhase] = useState<Phase>(preselected ? "details" : "select");
  const [category, setCategory] = useState<CardOffer["category"] | "All">("All");
  const [selected, setSelected] = useState<CardOffer | null>(preselected ?? null);
  const [income, setIncome] = useState("75000");
  const [result, setResult] = useState<CardApplication | null>(null);
  const [issuedCard, setIssuedCard] = useState<CreditCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && preselected) {
      setSelected(preselected);
      setPhase("details");
    }
  }, [open, preselected]);

  const offers = category === "All" ? CARD_OFFERS : CARD_OFFERS.filter((o) => o.category === category);

  const close = () => {
    onOpenChange(false);
    setTimeout(() => { setPhase("select"); setSelected(null); setResult(null); setIssuedCard(null); setIncome("75000"); setError(null); }, 250);
  };

  const pick = (offer: CardOffer) => { setSelected(offer); setPhase("details"); };

  const submit = async () => {
    if (!selected) return;
    setError(null);
    try {
      const card = await issueCard(selected);
      const app = applyForCard(selected.name);
      setResult(app);
      setIssuedCard(card);
      setPhase("success");
    } catch {
      setError("Couldn't issue this card. Please try again.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent className="flex flex-col gap-0 bg-card sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{phase === "select" ? "Find the right card for you" : "Apply for a Card"}</SheetTitle>
          <SheetDescription>Compare cards and apply in minutes.</SheetDescription>
        </SheetHeader>

        {phase === "select" && (
          <div className="mt-4 flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {offers.map((o) => (
                <button key={o.id} onClick={() => pick(o)} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CardIcon className="h-4 w-4" /></span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.headline} · ₹{o.annualFee.toLocaleString()} annual fee</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{o.category}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "details" && selected && (
          <div className="mt-4 flex-1 space-y-5">
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Card Selection</p>
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="font-medium text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.headline} · {selected.creditLimit}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Personal & Income Details</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full Name</Label>
                  <Input defaultValue="Bob User" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input defaultValue="bob.user@contoso.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Monthly Income</Label>
                  <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === "review" && selected && (
          <div className="mt-4 flex-1 space-y-4">
            <p className="text-sm font-semibold text-foreground">Review Application</p>
            <dl className="space-y-3 rounded-lg border border-border/60 p-4 text-sm">
              <Row label="Card" value={selected.name} />
              <Row label="Annual Fee" value={`₹${selected.annualFee.toLocaleString()}`} />
              <Row label="Monthly Income" value={`₹${Number(income).toLocaleString()}`} />
            </dl>
            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
            )}
          </div>
        )}

        {phase === "success" && result && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-8 w-8" /></span>
            <div>
              <p className="text-lg font-semibold text-foreground">Card Added</p>
              <p className="text-sm text-muted-foreground mt-1">Application ID</p>
              <p className="text-sm font-semibold text-foreground">{result.id}</p>
              <p className="text-xs text-muted-foreground mt-1">Status: Approved · Card added to My Credit Cards</p>
              {issuedCard && (
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {issuedCard.name} •••• {issuedCard.number.slice(-4)}
                </p>
              )}
            </div>
            <div className="w-full space-y-2 text-left text-xs">
              <TimelineRow label="Application submitted" done />
              <TimelineRow label="Verification" done />
              <TimelineRow label="Decision" done />
              <TimelineRow label="Card issuance" done />
            </div>
          </div>
        )}

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          {phase === "details" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("select")}>Back</Button>
              <Button className="flex-1" onClick={() => setPhase("review")}>Review</Button>
            </div>
          )}
          {phase === "review" && (
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("details")}>Back</Button>
              <Button className="flex-1" onClick={submit}>Submit Application</Button>
            </div>
          )}
          {phase === "success" && <Button className="w-full" onClick={close}>Done</Button>}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function TimelineRow({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-green-600" : active ? "bg-primary" : "bg-muted-foreground/30"}`} />
      <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
