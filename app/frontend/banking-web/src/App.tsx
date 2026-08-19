import type { ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "./components/Sidebar";
import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import Payments from "./pages/Payments";
import CreditCardManagement from "./pages/CreditCardManagement";
import InvestmentPortfolio from "./pages/InvestmentPortfolio";
import TransactionAnalytics from "./pages/TransactionAnalytics";
import Loans from "./pages/Loans";
import LoanExplore from "./pages/LoanExplore";
import CreditScore from "./pages/CreditScore";
import Documents from "./pages/Documents";
import Communications from "./pages/Communications";
import AIAssistant from "./pages/AIAssistant";
import ChatMetrics from "./pages/ChatMetrics";
import Account from "./pages/Account";
import Support from "./pages/Support";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AgentResponseProvider } from "@/context/AgentResponseContext";
import { FloatingAssistant } from "@/components/dashboard/FloatingAssistant";

const ProtectedShell = () => {
  // The full AI Assistant page already has its own chat surface open, so the
  // floating launcher would just be a redundant, overlapping copy there.
  const location = useLocation();
  const onAssistantPage = location.pathname.startsWith("/assistant");

  return (
    <AgentResponseProvider>
      {/* overflow-x-hidden + min-w-0 on the flex child keep wide content (tables,
          charts) scrolling inside its own container instead of pushing the page
          sideways. */}
      <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-background">
        <Navigation />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
        {!onAssistantPage && <FloatingAssistant />}
      </div>
    </AgentResponseProvider>
  );
};

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-base text-slate-500">Restoring your workspace…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <ProtectedShell />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="payments" element={<Payments />} />
              <Route path="credit-cards" element={<CreditCardManagement />} />
              <Route path="portfolio" element={<InvestmentPortfolio />} />
              <Route path="analytics" element={<TransactionAnalytics />} />
              <Route path="loans" element={<Loans />} />
              <Route path="loans/explore" element={<LoanExplore />} />
              <Route path="loans/explore/:categoryId" element={<LoanExplore />} />
              <Route path="credit-score" element={<CreditScore />} />
              <Route path="documents" element={<Documents />} />
              <Route path="communications" element={<Communications />} />
              <Route path="assistant" element={<AIAssistant />} />
              <Route path="assistant/metrics/:threadId" element={<ChatMetrics />} />
              <Route path="account" element={<Account />} />
              <Route path="support" element={<Support />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
