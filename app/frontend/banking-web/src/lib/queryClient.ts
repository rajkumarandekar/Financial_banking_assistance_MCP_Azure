// Single shared QueryClient instance. Lives outside App.tsx so non-component
// modules (e.g. loanCenterService.ts, after a mutation) can imperatively
// invalidate a query without needing a hook or risking a circular import
// back through App.tsx.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();
