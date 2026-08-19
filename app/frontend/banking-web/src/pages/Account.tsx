
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, CreditCard, Landmark, FileText, ShieldCheck } from "lucide-react";
import { bffClient } from "@/api/bffClient";
import { useQuery } from "@tanstack/react-query";
import { useAccountDetails, useCards, useLoans, useDocuments } from "@/hooks/useBankingData";
import { computeCustomerTier, formatTenure, TIER_STYLES } from "@/lib/relationship";

export default function Account() {
  const { data: account, isLoading: accountLoading } = useAccountDetails();
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => bffClient.getUserProfile(),
    staleTime: 60_000,
  });
  const { data: cards = [] } = useCards();
  const { data: loans = [] } = useLoans();
  const { data: documents = [] } = useDocuments();

  const activeCards = cards.filter((c) => c.status === "active");
  const activeLoans = loans.filter((l) => ["active", "approved"].includes((l.status ?? "").toLowerCase()));
  const totalCardLimit = cards.reduce((sum, c) => sum + (c.limit ?? 0), 0);
  const totalLoanPrincipal = loans.reduce((sum, l) => sum + (l.principalAmount ?? 0), 0);
  const totalRelationshipValue = (account?.balance ?? 0) + totalCardLimit + totalLoanPrincipal;
  const tier = computeCustomerTier(totalRelationshipValue);
  const tenure = formatTenure(account?.activationDate);

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "--";

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-slate-900">Account Overview</h1>
        <p className="text-slate-600 text-base">Access your essential account details, codes, agreements, and policy information. For any questions, please contact <a href="mailto:support@bankwise.com" className="text-green-600 underline">support@bankwise.com</a>.</p>
      </div>

      {/* Customer Identity - real record from customer-service, plus tier/tenure
          computed from real balance, card, and loan data (no invented figures). */}
      <Card className="p-8 shadow-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        {profileLoading || accountLoading ? (
          <div className="flex items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-full bg-slate-700" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48 bg-slate-700" />
              <Skeleton className="h-4 w-64 bg-slate-700" />
            </div>
          </div>
        ) : (
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <Avatar className="h-20 w-20 border-2 border-white/20">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold">{profile?.name ?? '--'}</h2>
              <Badge className={TIER_STYLES[tier]}>{tier} Member</Badge>
              <Badge variant="outline" className="border-white/30 text-white/90 gap-1">
                <ShieldCheck className="h-3 w-3" /> {profile?.role ?? 'customer'}
              </Badge>
            </div>
            <p className="text-slate-300 text-sm mb-3">{profile?.email ?? '--'}</p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-300">
              <span><span className="text-slate-400">Customer ID:</span> <span className="font-mono">{profile?.id ?? '--'}</span></span>
              <span><span className="text-slate-400">Member for:</span> {tenure}</span>
              <span><span className="text-slate-400">Since:</span> {account?.activationDate ? new Date(account.activationDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '--'}</span>
            </div>
          </div>
          <div className="text-left md:text-right shrink-0">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Total Relationship Value</p>
            <p className="text-3xl font-bold">₹{totalRelationshipValue.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Balance + credit limit + loan principal</p>
          </div>
        </div>
        )}
      </Card>

      {/* Relationship Summary - real product counts across every service */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 shadow-md border border-slate-200 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">1</p>
            <p className="text-xs text-slate-500">Bank Account</p>
          </div>
        </Card>
        <Card className="p-5 shadow-md border border-slate-200 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeCards.length}</p>
            <p className="text-xs text-slate-500">Active Cards ({cards.length} total)</p>
          </div>
        </Card>
        <Card className="p-5 shadow-md border border-slate-200 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <Landmark className="h-5 w-5 text-purple-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeLoans.length}</p>
            <p className="text-xs text-slate-500">Active Loans</p>
          </div>
        </Card>
        <Card className="p-5 shadow-md border border-slate-200 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{documents.length}</p>
            <p className="text-xs text-slate-500">Documents on File</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* General Information */}
        <Card className="p-8 shadow-xl border border-slate-200 flex-1">
          <section>
            <h2 className="text-xl font-semibold mb-2 text-slate-800 flex items-center gap-2">
              General Information
            </h2>
            <div className="text-slate-700 text-base leading-relaxed">
              <div className="mb-2"><span className="font-medium">Account Holder:</span> {account?.accountHolderFullName ?? '--'}</div>
              <div className="mb-2"><span className="font-medium">Account ID:</span> {account?.id ?? '--'}</div>
              <div className="mb-2"><span className="font-medium">Currency:</span> {account?.currency ? 'INR (₹)' : '--'}</div>
              <div className="mb-2"><span className="font-medium">Status:</span> <span className="text-green-600 font-semibold">Active</span></div>
              <div><span className="font-medium">Opened:</span> {account?.activationDate ? new Date(account.activationDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '--'}</div>
            </div>
          </section>
        </Card>
        {/* Account Codes */}
        <Card className="p-8 shadow-xl border border-slate-200 flex-1">
          <section>
            <h2 className="text-xl font-semibold mb-2 text-slate-800 flex items-center gap-2">
              Account Codes
            </h2>
            {/* No SWIFT/IBAN/routing concept exists in the backend's account
                model - these are illustrative placeholders, not real values. */}
            <div className="grid grid-cols-1 gap-4 text-slate-700">
              <div><span className="font-medium">Account Number:</span> <span className="font-mono tracking-wider">1234 5678 9012 3456</span></div>
              <div><span className="font-medium">SWIFT Code:</span> <span className="font-mono tracking-wider">BWAIUS33</span></div>
              <div><span className="font-medium">IBAN:</span> <span className="font-mono tracking-wider">US00BWAI12345678901234</span></div>
              <div><span className="font-medium">Routing Number:</span> <span className="font-mono tracking-wider">021000021</span></div>
            </div>
          </section>
        </Card>
        {/* Agreements */}
        <Card className="p-8 shadow-xl border border-slate-200 flex-1">
          <section>
            <h2 className="text-xl font-semibold mb-2 text-slate-800 flex items-center gap-2">
              Agreements
            </h2>
            <ul className="list-disc ml-6 text-slate-700 space-y-2">
              <li>
                <a href="#" className="text-green-600 underline font-medium">Terms of Service</a> — Outlines your rights and responsibilities as an account holder.
              </li>
              <li>
                <a href="#" className="text-green-600 underline font-medium">Electronic Communications Agreement</a> — Details how we deliver important information electronically.
              </li>
              <li>
                <a href="#" className="text-green-600 underline font-medium">Fee Schedule</a> — Provides information on account-related fees.
              </li>
            </ul>
          </section>
        </Card>
        {/* Policy */}
        <Card className="p-8 shadow-xl border border-slate-200 flex-1">
          <section>
            <h2 className="text-xl font-semibold mb-2 text-slate-800 flex items-center gap-2">
              Privacy & Security Policy
            </h2>
            <div className="text-slate-700 text-base leading-relaxed">
              <p className="mb-2">Your privacy and security are our top priorities. We use industry-leading encryption and security practices to protect your data and financial information.</p>
              <p className="mb-2">We do <span className="font-semibold">not</span> share your information with third parties without your explicit consent. You can review our full policy below:</p>
              <a href="#" className="text-green-600 underline font-medium">View Privacy Policy</a>
            </div>
          </section>
        </Card>
      </div>
    </div>
  );
}
