import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

/**
 * Refetch when a screen regains focus.
 *
 * React Query already refetches on mount and on app foreground, but neither fires when
 * you pop back to a screen that stayed mounted underneath a pushed one. That gap matters
 * here: the integration doc (§2.3) wants screen data re-derived from the server every
 * time it is shown, so a shop you just transferred reads correctly when you come back
 * to the list.
 *
 * Skips the first focus, because mount has already fetched.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch])
  );
}
