import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

/**
 * Refetch when a screen regains focus.
 *
 * React Query already refetches on mount and on app foreground, but neither fires when you
 * pop back to a screen that stayed mounted underneath a pushed one. That gap matters here:
 * integration doc §2.3 wants screen data re-derived from the server every time it is shown,
 * so a shop you just transferred reads correctly when you come back to the list.
 *
 * Skips the first focus, because mount has already fetched.
 *
 * The callback is held in a ref and the focus effect has **empty deps** — deliberately. An
 * earlier version listed `refetch` in the deps, which turned any inline arrow at the call
 * site into an infinite loop: new function each render → new effect → refetch → re-render →
 * new function. Home passed `() => { shops.refetch(); people.refetch() }` and span
 * continuously. Callers must not have to memoise to use this safely.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const firstFocus = useRef(true);
  const latest = useRef(refetch);

  // Keep the newest callback without letting its identity drive the effect.
  latest.current = refetch;

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      latest.current();
    }, [])
  );
}
