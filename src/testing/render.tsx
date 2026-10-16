/**
 * Test helpers. Not a spec file — deliberately outside any `__tests__` directory, because
 * jest treats everything in there as a suite.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * A query client with retries and network-awareness off, so a test asserts one attempt and
 * finishes immediately rather than waiting out a backoff.
 *
 * `gcTime: Infinity` on both: a finite one leaves a timer running (five minutes by default)
 * after every query or mutation, and a single test file — run in the main process rather
 * than a worker — then sits for those five minutes before Jest can exit.
 */
export function testQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity }
    }
  });
}

/** Wrapper for `render` / `renderHook` that supplies the query cache. */
export function withQueryClient(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
