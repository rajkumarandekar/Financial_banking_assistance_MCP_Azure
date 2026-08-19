import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_GROUPS, NAV_FOOTER, type NavItem } from "@/lib/navigation";

// A sub-item stays hidden until its parent section is the active route -
// e.g. "Explore Loans" only appears once you're actually on /loans/*,
// instead of permanently cluttering the rail.
function isParentActive(pathname: string, parentHref: string): boolean {
  return pathname === parentHref || pathname.startsWith(`${parentHref}/`);
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const renderItem = ({ name, href, icon: Icon, isSub }: NavItem) => {
    const link = (
      <NavLink
        to={href}
        end={href === "/" || href === "/loans"}
        aria-label={collapsed ? name : undefined}
        className={({ isActive }) =>
          `flex items-center rounded-lg text-sm font-medium transition-all duration-200 ${
            collapsed ? "justify-center px-3 py-2.5" : isSub ? "py-2 pl-9 pr-3" : "px-3 py-2.5"
          } ${
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          }`
        }
      >
        <Icon className={`shrink-0 ${isSub && !collapsed ? "h-4 w-4" : "h-5 w-5"} ${collapsed ? "" : "mr-3"}`} aria-hidden="true" />
        {!collapsed && <span className="truncate">{name}</span>}
      </NavLink>
    );

    // The collapsed rail hides labels, so a tooltip restores the affordance.
    return collapsed ? (
      <Tooltip key={name} delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
    ) : (
      link
    );
  };

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-professional transition-all duration-300 md:flex ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <nav className="flex flex-1 flex-col px-3 pt-3">
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="rounded p-1 transition-colors hover:bg-slate-100"
          >
            {collapsed ? <ChevronRight className="h-4 w-4 text-slate-600" /> : <ChevronLeft className="h-4 w-4 text-slate-600" />}
          </button>
        </div>

        <div className="space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item, idx) => {
                  if (item.isSub) {
                    const parent = [...group.items.slice(0, idx)].reverse().find((i) => !i.isSub);
                    if (!parent || !isParentActive(location.pathname, parent.href)) return null;
                  }
                  return <li key={item.name}>{renderItem(item)}</li>;
                })}
              </ul>
            </div>
          ))}
        </div>

        <ul className="mt-auto space-y-1 border-t border-sidebar-border py-3">
          {NAV_FOOTER.map((item) => (
            <li key={item.name}>{renderItem(item)}</li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
