import { Wifi } from "lucide-react";
import { CreditCard } from "@/models/CreditCard";
import { cn } from "@/common/utils";

// A realistic physical-card look (gradient plastic, chip, contactless icon,
// embossed number/name) instead of the plain white info tile. Pure visual
// component - it renders the same real card data, just styled like a card.

const CIRCUIT_GRADIENTS: Record<string, string> = {
  visa: "from-blue-700 via-blue-800 to-slate-900",
  mastercard: "from-orange-600 via-red-700 to-slate-900",
  amex: "from-slate-700 via-slate-800 to-black",
};

const CIRCUIT_LOGO: Record<string, string> = {
  visa: "VISA",
  mastercard: "Mastercard",
  amex: "AMEX",
};

interface CreditCardVisualProps {
  card: CreditCard;
  className?: string;
}

export function CreditCardVisual({ card, className }: CreditCardVisualProps) {
  const gradient = CIRCUIT_GRADIENTS[card.circuit] ?? "from-slate-700 via-slate-800 to-black";
  const isBlocked = card.status === "blocked";

  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] w-full rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg overflow-hidden select-none",
        gradient,
        isBlocked && "grayscale opacity-70",
        className
      )}
    >
      {/* Decorative sheen */}
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          {/* Chip */}
          <div className="h-8 w-10 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 shadow-inner" />
          <Wifi className="h-5 w-5 rotate-90 text-white/80" />
        </div>

        <div>
          <p className="font-mono text-lg tracking-widest drop-shadow-sm">
            •••• •••• •••• {card.number.slice(-4)}
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/60">Card Holder</p>
            <p className="text-sm font-medium tracking-wide">{card.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-white/60">Expires</p>
            <p className="text-sm font-medium">
              {new Date(card.expirationDate).toLocaleDateString(undefined, { month: "2-digit", year: "2-digit" })}
            </p>
          </div>
          <p className="text-lg font-bold italic tracking-tight">{CIRCUIT_LOGO[card.circuit] ?? card.circuit}</p>
        </div>
      </div>

      {isBlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            Blocked
          </span>
        </div>
      )}
    </div>
  );
}
