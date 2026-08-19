// Global search over the data the app has already cached - real transactions,
// real cards, real destinations. It is a working search, not a decorative
// input: selecting a result navigates. Opens on click or ⌘K / Ctrl-K.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CreditCard, Receipt, LayoutDashboard, Landmark, Gauge, FileText, Bell, Bot } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useTransactions, useCards } from "@/hooks/useBankingData";
import { formatINR } from "@/lib/chartTokens";

const PAGES = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "AI Assistant", to: "/assistant", icon: Bot },
  { label: "Payments", to: "/payments", icon: Receipt },
  { label: "Credit Cards", to: "/credit-cards", icon: CreditCard },
  { label: "Loans", to: "/loans", icon: Landmark },
  { label: "Credit Score", to: "/credit-score", icon: Gauge },
  { label: "Documents", to: "/documents", icon: FileText },
  { label: "Communications", to: "/communications", icon: Bell },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: transactions = [] } = useTransactions();
  const { data: cards = [] } = useCards();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // cmdk does its own fuzzy filtering; we just cap the list so the dialog
  // doesn't try to render a whole ledger.
  const recentTransactions = useMemo(
    () => [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 40),
    [transactions]
  );

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">Search transactions, bills, cards...</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search transactions, bills, cards..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Go to">
            {PAGES.map(({ label, to, icon: Icon }) => (
              <CommandItem key={to + label} value={label} onSelect={() => go(to)}>
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>

          {cards.length > 0 && (
            <CommandGroup heading="Cards">
              {cards.map((card) => (
                <CommandItem key={card.id} value={`${card.name} ${card.number}`} onSelect={() => go("/credit-cards")}>
                  <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{card.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    •••• {card.number.slice(-4)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {recentTransactions.length > 0 && (
            <CommandGroup heading="Transactions">
              {recentTransactions.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.description} ${t.category ?? ""}`}
                  onSelect={() => go("/analytics")}
                >
                  <Receipt className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{t.description}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatINR(Math.abs(t.amount))}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
