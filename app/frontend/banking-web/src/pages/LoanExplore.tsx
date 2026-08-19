// Second Loans screen: a category deep-dive (rates, offers, eligibility,
// and an amount/tenure picker) reached from Explore Loans on the main
// Loans page. Same lending data as Loans.tsx, scoped to one loan type.
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Car, Home, GraduationCap, Briefcase } from "lucide-react";
import { useCreditScore } from "@/hooks/useBankingData";
import { LOAN_PRODUCTS, calculateEMI } from "@/lib/loanCenterService";
import { LoanOffersCompare } from "@/components/loans/LoanOffersCompare";
import { LoanEligibilityChecker } from "@/components/loans/LoanEligibility";
import { LoanActionDrawer } from "@/components/loans/LoanActionDrawer";
import type { LoanType, LoanOffer } from "@/models/LoanCenter";

const ICONS: Record<LoanType, typeof User> = {
  personal: User, auto: Car, home: Home, education: GraduationCap, business: Briefcase,
};

export default function LoanExplore() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { data: creditScore } = useCreditScore();

  const product = LOAN_PRODUCTS.find((p) => p.type === categoryId) ?? LOAN_PRODUCTS[0];
  const Icon = ICONS[product.type];

  const [amount, setAmount] = useState(Math.min(500000, product.maxAmount));
  const [tenure, setTenure] = useState(36);
  const [applyOffer, setApplyOffer] = useState<LoanOffer | null>(null);

  const emi = useMemo(() => calculateEMI(amount, product.ratesFrom, tenure), [amount, product.ratesFrom, tenure]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <button onClick={() => navigate("/loans")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Back to Loans
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Explore Loans</h1>
        <p className="text-sm text-muted-foreground">Find a loan that fits your needs.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LOAN_PRODUCTS.map((p) => {
          const TabIcon = ICONS[p.type];
          const active = p.type === product.type;
          return (
            <button
              key={p.type}
              onClick={() => navigate(`/loans/explore/${p.type}`)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />{p.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground">{product.label}</h2>
          <p className="text-sm text-muted-foreground">{product.description}</p>
        </div>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-foreground">Choose your amount & tenure</h3>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Loan Amount</p>
                <Input value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="h-7 w-32 text-right text-xs" />
              </div>
              <Slider className="mt-2" value={[amount]} min={10000} max={product.maxAmount} step={10000} onValueChange={([v]) => setAmount(v)} />
              <p className="mt-1 text-[11px] text-muted-foreground">Up to ₹{(product.maxAmount / 100000).toLocaleString()}L</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Tenure (months)</p>
                <Input value={tenure} onChange={(e) => setTenure(Number(e.target.value) || 0)} className="h-7 w-32 text-right text-xs" />
              </div>
              <Slider className="mt-2" value={[tenure]} min={6} max={360} step={6} onValueChange={([v]) => setTenure(v)} />
              <p className="mt-1 text-[11px] text-muted-foreground">Estimated EMI from {product.ratesFrom}% APR: ₹{Math.round(emi).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <LoanOffersCompare loanType={product.type} amount={amount} tenureMonths={tenure} onApply={setApplyOffer} />

      <LoanEligibilityChecker creditScore={creditScore?.score ?? 690} />

      <LoanActionDrawer
        mode={applyOffer ? "apply" : null}
        applyContext={applyOffer ? { type: product.type, lenderName: applyOffer.lenderName, amount, tenureMonths: tenure } : null}
        onClose={() => setApplyOffer(null)}
      />
    </div>
  );
}
