import { useQuery } from "@tanstack/react-query";
import { meApi } from "../api";
import { queryKeys } from "../app/queryKeys";
import { useAuth } from "./AuthContext";

/**
 * The signed-in user's identity and current role.
 *
 * This is the only place the role comes from. It refetches on mount and on foreground,
 * so a role change made by an admin on another device lands on the next screen.
 */
export function useMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: meApi.get,
    // Pointless while signed out or locked, and on the unlock screen the access token
    // may already be expired — let the unlock flow rotate it first.
    enabled: status === "ready"
  });
}
