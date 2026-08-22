import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import { ApiError } from "../api";

/**
 * `staleTime: 0` is deliberate. The integration doc (§2.3) requires that "rights and data
 * are re-derived from the server on every screen" — so every mount and every return to
 * the foreground refetches. The committee is five or six people; the extra requests cost
 * nothing next to showing someone a stale role or a shop that has since been transferred.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        retry(failureCount, error) {
          // A 4xx is an answer, not a hiccup — retrying it just burns time and, for
          // rate-limited endpoints, makes things worse. Network failures (status 0) and
          // 5xx are worth one more go.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000)
      },
      mutations: {
        // Never silently replay a write. There is no offline mode, and a duplicated
        // POST would create a duplicate record.
        retry: false
      }
    }
  });
}

/**
 * React Query's default focus detection is a browser API. Point it at `AppState` so
 * bringing the app back from the background counts as a focus event.
 */
export function wireAppStateFocus() {
  const onChange = (state: AppStateStatus) => focusManager.setFocused(state === "active");
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
}
