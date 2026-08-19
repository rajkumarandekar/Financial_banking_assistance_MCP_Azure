
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Settings, LogOut, User, Landmark, Bell, Mail, ShieldAlert, AlertTriangle, Info, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAccountDetails, useCards, useLoans, useCreditScore, useCommunications } from "@/hooks/useBankingData";
import { computeSmartAlerts, AlertSeverity } from "@/lib/alerts";
import { useSeenCommunicationIds } from "@/lib/communicationReadState";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileNav } from "@/components/MobileNav";

const SEVERITY_ICON: Record<AlertSeverity, typeof AlertTriangle> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  critical: "text-red-600",
  warning: "text-yellow-600",
  info: "text-primary",
};

export default function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: account } = useAccountDetails();
  const { data: cards } = useCards();
  const { data: loans } = useLoans();
  const { data: creditScore } = useCreditScore();
  const { data: communications = [] } = useCommunications();
  const { data: seenCommunicationIds } = useSeenCommunicationIds();
  const unreadCommunications = communications.filter((c) => !seenCommunicationIds?.has(c.id));
  const alerts = computeSmartAlerts({ account, cards, loans, creditScore });

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "EB";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleSettings = () => {
    navigate("/account");
  };

  return (
    <nav className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-4 sm:px-6">
      <MobileNav />
      <div className="flex shrink-0 items-center space-x-3">
        <div className="hidden h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-green-700 shadow-md sm:flex">
          <Landmark className="h-5 w-5 text-white" />
        </div>
        <div className="hidden sm:block">
          <h2 className="text-lg font-bold leading-tight text-slate-900">SecureBank</h2>
          <p className="text-xs leading-none text-slate-500">Agentic Banking</p>
        </div>
      </div>

      {/* Global search occupies the centre and shrinks before anything else */}
      <div className="flex min-w-0 flex-1 justify-center">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          className="gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-white shadow-md shadow-indigo-600/20 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-indigo-600/30 sm:px-4"
          aria-label="AI Assistant"
          onClick={() => navigate("/assistant")}
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">AI Assistant</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-slate-50"
          aria-label={`Messages${unreadCommunications.length ? `, ${unreadCommunications.length} unread` : ""}`}
          onClick={() => navigate("/communications")}
        >
          <Mail className="h-5 w-5 text-slate-600" />
          {unreadCommunications.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCommunications.length}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative hover:bg-slate-50" aria-label={`Notifications${alerts.length ? `, ${alerts.length} unread` : ""}`}>
              <Bell className="h-5 w-5 text-slate-600" />
              {alerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-white">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alerts.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500 text-center">You're all caught up.</p>
            ) : (
              alerts.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity];
                return (
                  <DropdownMenuItem key={alert.id} className="items-start gap-2 whitespace-normal py-2">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      <p className="text-xs text-slate-500">{alert.description}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden text-right lg:block">
          <div className="text-sm font-medium text-slate-900">{user?.name ?? "Enterprise User"}</div>
          <div className="max-w-[200px] truncate text-xs text-slate-500">{user?.email ?? "loading…"}</div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2 hover:bg-slate-50">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar} alt={user?.name ?? "Enterprise User"} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white">
            <DropdownMenuLabel>
              <div>
                <div className="font-medium">{user?.name ?? "Enterprise User"}</div>
                {user?.accountId && (
                  <div className="text-xs text-slate-400">Account {user.accountId}</div>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 hover:text-red-600 hover:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
