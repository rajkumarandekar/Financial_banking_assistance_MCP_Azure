// Single navigation definition, shared by the desktop sidebar and the mobile
// drawer so the two can never drift apart.
import {
  BarChart3, CreditCard, TrendingUp, Wallet, User, Landmark, Gauge,
  FileText, Bell, LifeBuoy, Compass, LineChart,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: typeof BarChart3;
  /** Renders indented, as a sub-item of the entry directly above it. */
  isSub?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Only the domains actually backed by one of the 8 microservices get an entry.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: BarChart3 },
    ],
  },
  {
    label: "Banking",
    items: [
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "Credit Cards", href: "/credit-cards", icon: Wallet },
      { name: "Transaction Analytics", href: "/analytics", icon: TrendingUp },
    ],
  },
  {
    label: "Credit",
    items: [
      { name: "Loans", href: "/loans", icon: Landmark },
      { name: "Explore Loans", href: "/loans/explore", icon: Compass, isSub: true },
      { name: "Credit Score", href: "/credit-score", icon: Gauge },
    ],
  },
  {
    label: "Investing",
    items: [
      { name: "Investments", href: "/portfolio", icon: LineChart },
    ],
  },
  {
    label: "Records",
    items: [
      { name: "Documents", href: "/documents", icon: FileText },
      { name: "Communications", href: "/communications", icon: Bell },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { name: "Support", href: "/support", icon: LifeBuoy },
  { name: "Account", href: "/account", icon: User },
];
