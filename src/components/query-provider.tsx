"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for the CLIENT-side data only.
 *
 * Catalogue pages stay server components — they render from the DB during the
 * request, so there's nothing for a client cache to do there and moving them
 * would cost SSR and the streaming skeletons. What this covers is the work
 * that genuinely happens in the browser: the typeahead, and the admin panel,
 * which drives ~30 server actions from effects.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // created once per browser session — a module-level client would leak state
  // between users during SSR
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // these are server actions, not flaky HTTP; one retry is plenty
            retry: 1,
            // a typed query rarely changes between two keystrokes
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
