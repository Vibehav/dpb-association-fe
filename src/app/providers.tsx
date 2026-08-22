import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { LoadingScreen } from "../components/ui";
import { useAppFonts } from "../theme/fonts";
import { createQueryClient, wireAppStateFocus } from "./queryClient";

/**
 * Everything the app tree needs, in one place: fonts, safe-area insets, the query cache,
 * and the auth session.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const fontsReady = useAppFonts();
  // One client for the app's lifetime. Recreating it would drop every cache entry.
  const [queryClient] = useState(createQueryClient);

  useEffect(wireAppStateFocus, []);

  if (!fontsReady) return <LoadingScreen />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SessionCacheReset />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Drop every cached response when a session ends.
 *
 * Without this, signing out and back in as a different member would briefly serve the
 * previous user's `/me`, shops and people out of cache — including their role, which is
 * exactly the thing that must never be stale.
 */
function SessionCacheReset() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const previous = useRef(status);

  useEffect(() => {
    if (previous.current !== "signedOut" && status === "signedOut") {
      queryClient.clear();
    }
    previous.current = status;
  }, [status, queryClient]);

  return null;
}
