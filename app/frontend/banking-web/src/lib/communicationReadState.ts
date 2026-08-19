// Tracks which communication ids the user has already seen, so the header
// badge shows an actual unread count instead of the total count forever.
// Backed by localStorage (no server-side "read" field exists) and surfaced
// reactively via a React Query cache entry, so Navigation's badge updates
// the moment the Communications page marks items as seen, without needing
// a page reload or a custom event system.
import { useQuery, type QueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "securebank_seen_communication_ids";
export const SEEN_COMMUNICATIONS_QUERY_KEY = ["communication-read-state"] as const;

function readSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable (private browsing, quota) - unread count just
    // won't persist across reloads, not worth failing the page over.
  }
}

export function useSeenCommunicationIds() {
  return useQuery({
    queryKey: SEEN_COMMUNICATIONS_QUERY_KEY,
    queryFn: readSeenIds,
    initialData: readSeenIds,
    staleTime: Infinity,
  });
}

export function markCommunicationsSeen(ids: string[], queryClient: QueryClient) {
  if (ids.length === 0) return;
  const current = readSeenIds();
  const next = new Set(current);
  for (const id of ids) next.add(id);
  writeSeenIds(next);
  queryClient.setQueryData(SEEN_COMMUNICATIONS_QUERY_KEY, next);
}
