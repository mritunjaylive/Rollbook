import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import * as api from "@/lib/rollbook/api";
import { SNAPSHOT_KEY } from "@/lib/rollbook/queries";

/**
 * Silently backfills the user's IANA timezone on the profile row the first
 * time the snapshot loads and shows no timezone set. No UI \u2014 this is purely
 * automatic, fire-and-forget. Rendered inside QueryClientProvider so it can
 * call useQuery.
 */
function TimezoneBackfill() {
  const snap = useQuery<import("@/lib/rollbook/types").Snapshot | null>({
    queryKey: SNAPSHOT_KEY,
    // Don't re-fetch \u2014 this component just reads whatever is already cached.
    staleTime: Infinity,
    enabled: false,
  });
  const timezone = snap.data?.profile?.timezone;
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (sent) return;
    if (timezone) { setSent(true); return; } // already stored
    if (snap.isLoading || snap.isPending) return; // wait for first load
    if (!snap.data?.profile) return; // no profile yet (not set up)

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      setSent(true);
      // Fire-and-forget: don't block or show any UI on failure.
      api.updateTimezone({ data: { timezone: tz } }).catch(() => {});
    } catch {
      // Intl not supported in this environment \u2014 silently skip.
    }
  }, [timezone, snap.isLoading, snap.isPending, snap.data?.profile, sent]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <TimezoneBackfill />
      <Toaster
        position="top-center"
        toastOptions={{
          className:
            "font-[Figtree,system-ui,sans-serif] !bg-page !text-ink !border-line",
        }}
      />
    </QueryClientProvider>
  );
}
