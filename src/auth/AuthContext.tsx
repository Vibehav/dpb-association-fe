/**
 * Owns tokens and the app-lock. Nothing else.
 *
 * Notably it does **not** hold the user's name or role. Those come from `GET /me` via
 * `useMe()` so a mid-session demotion or removal takes effect on the next screen, which
 * the integration doc (§2.3) and the functional spec (§13.2 #7) both call out explicitly.
 * The old implementation persisted the role from the login response and never refreshed it.
 *
 * The PIN is never written to disk. Only the token pair and the signed-in number are.
 */

import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { ApiError, authApi, configureClient, forceRefresh, type TokenPair } from "../api";

const SESSION_KEY = "dpb.session";

/** Inactivity before the PIN is required again. Left open by the spec (§3); 5 min chosen. */
const LOCK_AFTER_MS = 5 * 60 * 1000;

/** Treat a token expiring within this window as already expired. Covers clock skew. */
const EXPIRY_SKEW_MS = 60 * 1000;

const ACTIVITY_CHECK_MS = 30 * 1000;

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. Derived from the pair's `expiresInSeconds` at the moment it was issued. */
  accessTokenExpiresAt: number;
  /** The 10-digit number that signed in — shown on the Account screen. */
  phone: string;
};

export type AuthStatus = "loading" | "signedOut" | "locked" | "ready";

type AuthContextValue = {
  status: AuthStatus;
  /** The signed-in number, for display. Null when signed out. */
  phone: string | null;
  signIn: (phone: string, pin: string) => Promise<void>;
  /** Completes first-login / forgot-PIN / change-PIN: sets the PIN and signs in. */
  completePinSetup: (phone: string, resetToken: string, newPin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  signOut: () => Promise<void>;
  recordActivity: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [phone, setPhone] = useState<string | null>(null);

  /** The live session. A ref because the HTTP client reads it outside React's lifecycle. */
  const sessionRef = useRef<StoredSession | null>(null);
  const lastActivityRef = useRef(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const persist = useCallback(async (next: StoredSession | null) => {
    sessionRef.current = next;
    setPhone(next?.phone ?? null);
    if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  }, []);

  const adopt = useCallback(
    async (tokens: TokenPair, signedInPhone: string) => {
      await persist({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: Date.now() + tokens.expiresInSeconds * 1000,
        phone: signedInPhone
      });
      lastActivityRef.current = Date.now();
      setStatus("ready");
    },
    [persist]
  );

  // --- restore on cold start ------------------------------------------------
  // A restored session always comes back *locked*: the tokens are still good but the
  // PIN has to be re-entered, per the app-lock rule in §2.3.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (!active) return;
        if (raw) {
          const restored = JSON.parse(raw) as StoredSession;
          if (restored?.accessToken && restored?.refreshToken) {
            sessionRef.current = restored;
            setPhone(restored.phone ?? null);
            setStatus("locked");
            return;
          }
        }
        setStatus("signedOut");
      } catch {
        // Corrupt payload — start clean rather than wedging on the splash screen.
        await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
        if (active) setStatus("signedOut");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // --- wire the HTTP client ------------------------------------------------
  useEffect(() => {
    configureClient({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      getRefreshToken: () => sessionRef.current?.refreshToken ?? null,
      async onTokensRefreshed(tokens) {
        const current = sessionRef.current;
        if (!current) return;
        await persist({
          ...current,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpiresAt: Date.now() + tokens.expiresInSeconds * 1000
        });
      },
      async onSessionExpired() {
        await persist(null);
        setStatus("signedOut");
      }
    });
    return () => configureClient(null);
  }, [persist]);

  // --- inactivity lock -----------------------------------------------------
  useEffect(() => {
    if (status !== "ready") return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= LOCK_AFTER_MS) setStatus("locked");
    }, ACTIVITY_CHECK_MS);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "background" || nextState === "inactive") {
        lastActivityRef.current = Date.now();
        return;
      }
      if (previous !== "active" && nextState === "active" && sessionRef.current) {
        if (Date.now() - lastActivityRef.current >= LOCK_AFTER_MS) setStatus("locked");
        else lastActivityRef.current = Date.now();
      }
    });
    return () => subscription.remove();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    /**
     * `POST /auth/verify-pin` needs a *usable* access token, but it lives under the API's
     * public `/auth/**` matcher — so an expired token doesn't yield a clean 401 we could
     * refresh on. It reaches the controller unauthenticated and the principal is null.
     * Rotate first so the call is made with a good token.
     */
    async function ensureUsableAccessToken(): Promise<boolean> {
      const current = sessionRef.current;
      if (!current) return false;
      if (current.accessTokenExpiresAt - EXPIRY_SKEW_MS > Date.now()) return true;
      return (await forceRefresh()) !== null;
    }

    return {
      status,
      phone,

      async signIn(nextPhone, pin) {
        const tokens = await authApi.login(nextPhone, pin);
        await adopt(tokens, nextPhone);
      },

      async completePinSetup(nextPhone, resetToken, newPin) {
        const tokens = await authApi.setPin(resetToken, newPin);
        await adopt(tokens, nextPhone);
      },

      async unlock(pin) {
        if (!sessionRef.current) {
          setStatus("signedOut");
          throw new ApiError(401, "unauthorized", "Please sign in again.");
        }

        if (!(await ensureUsableAccessToken())) {
          // The refresh token was rejected — an admin reset this PIN or removed the
          // member. `onSessionExpired` has already cleared storage.
          throw new ApiError(401, "unauthorized", "Your session ended. Please sign in again.");
        }

        try {
          await authApi.verifyPin(pin);
        } catch (caught) {
          // A wrong PIN is a 401 `wrong_pin` and must surface as-is — it counts toward
          // the server's 5-attempt lockout, so it is never retried. Anything else means
          // the token was rejected after all; rotate once and try the PIN again.
          const tokenProblem =
            caught instanceof ApiError &&
            caught.code !== "wrong_pin" &&
            caught.code !== "pin_locked" &&
            (caught.status === 401 || caught.status >= 500);

          if (!tokenProblem) throw caught;
          if (!(await forceRefresh())) {
            throw new ApiError(401, "unauthorized", "Your session ended. Please sign in again.");
          }
          await authApi.verifyPin(pin);
        }

        lastActivityRef.current = Date.now();
        setStatus("ready");
      },

      lock() {
        if (sessionRef.current) setStatus("locked");
      },

      async signOut() {
        const refreshToken = sessionRef.current?.refreshToken;
        await persist(null);
        setStatus("signedOut");
        // Best effort — the local session is already gone either way.
        if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
      },

      recordActivity() {
        if (status === "ready") lastActivityRef.current = Date.now();
      }
    };
  }, [adopt, persist, phone, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
