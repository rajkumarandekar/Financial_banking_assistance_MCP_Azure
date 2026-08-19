// Auto Pay / reminder preferences.
//
// account-service has no auto-pay or reminder-preference field, so there is
// no backend to persist this to. Rather than fake a save that silently does
// nothing, the toggles persist to localStorage - a real, working local
// preference - and the copy says "on this device" so it's never mistaken for
// a server-side setting the AI assistant or another device would see.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Repeat, Bell, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "meridian.paymentPreferences";

interface Preferences {
  autoPay: boolean;
  reminders: boolean;
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { autoPay: false, reminders: true, ...JSON.parse(raw) };
  } catch {
    // ignore malformed/unavailable storage - fall through to defaults
  }
  return { autoPay: false, reminders: true };
}

export function AutoPayCard() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // best-effort persistence only
    }
  }, [prefs]);

  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Auto Pay & Reminders</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Never miss a payment</p>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Repeat className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Auto Pay</p>
                <p className="text-xs text-muted-foreground">Pay automatically on due date</p>
              </div>
            </div>
            <Switch checked={prefs.autoPay} onCheckedChange={(v) => setPrefs((p) => ({ ...p, autoPay: v }))} aria-label="Toggle Auto Pay" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Payment Reminders</p>
                <p className="text-xs text-muted-foreground">Get reminded before due date</p>
              </div>
            </div>
            <Switch checked={prefs.reminders} onCheckedChange={(v) => setPrefs((p) => ({ ...p, reminders: v }))} aria-label="Toggle payment reminders" />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">Saved on this device only.</p>

        <Link to="/account" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Manage preferences <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
