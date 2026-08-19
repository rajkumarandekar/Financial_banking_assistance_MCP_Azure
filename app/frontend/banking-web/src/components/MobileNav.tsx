// Below `md` the sidebar is hidden, so navigation moves into a drawer behind a
// hamburger in the header. Shares NAV_GROUPS with the desktop sidebar so the
// two can't drift apart.
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NAV_GROUPS, NAV_FOOTER, type NavItem } from "@/lib/navigation";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  const renderItem = ({ name, href, icon: Icon }: NavItem) => (
    <li key={name}>
      <NavLink
        to={href}
        end={href === "/"}
        onClick={() => setOpen(false)}
        className={({ isActive }) =>
          `flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          }`
        }
      >
        <Icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="truncate">{name}</span>
      </NavLink>
    </li>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5 text-slate-600" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto bg-card p-0">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-green-700">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-slate-900">SecureBank</p>
            <p className="text-xs leading-none text-slate-500">Agentic Banking</p>
          </div>
        </div>

        <nav className="space-y-5 px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <ul className="space-y-1">{group.items.map(renderItem)}</ul>
            </div>
          ))}
          <ul className="space-y-1 border-t border-border pt-4">{NAV_FOOTER.map(renderItem)}</ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
