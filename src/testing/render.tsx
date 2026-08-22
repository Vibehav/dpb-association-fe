/**
 * Test helpers. Not a spec file — deliberately outside any `__tests__` directory, because
 * jest treats everything in there as a suite.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * A query client with retries and network-awareness off, so a test asserts one attempt and
 * finishes immediately rather than waiting out a backoff.
 */
export function testQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false }
    }
  });
}

/** Wrapper for `render` / `renderHook` that supplies the query cache. */
export function withQueryClient(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
