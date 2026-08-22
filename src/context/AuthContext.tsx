import * as SecureStore from "expo-secure-store";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { authApi } from "../api";
import { configureAuthRefresh } from "../api/client";
import { AuthSession } from "../types";

type AuthContextValue = {
  session: AuthSession | null;
  initializing: boolean;
  locked: boolean;
  recordActivity: () => void;
  lock: () => void;
  signIn: (phone: string, pin: string) => Promise<void>;
  setPinAndSignIn: (phone: string, resetToken: string, newPin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_TOKEN_KEY = "dpb.accessToken";
const REFRESH_TOKEN_KEY = "dpb.refreshToken";
const SESSION_USER_KEY = "dpb.user";
const LOCK_AFTER_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [locked, setLocked] = useState(false);
  const sessionRef = useRef<AuthSession | null>(null);
  const lastActivityRef = useRef(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      try {
        const [token, refreshToken, userJson] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
          SecureStore.getItemAsync(SESSION_USER_KEY)
        ]);
        if (mounted && token && refreshToken && userJson) {
          setSession({ token, refreshToken, user: JSON.parse(userJson) });
          setLocked(true);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    }
    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    configureAuthRefresh({
      getRefreshToken: () => sessionRef.current?.refreshToken || null,
      async onRefresh(tokens) {
        const currentSession = sessionRef.current;
        if (!currentSession) return;
        const nextSession: AuthSession = {
          ...currentSession,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken
        };
        await persistSession(nextSession);
        sessionRef.current = nextSession;
        setSession(nextSession);
      },
      async onRefreshFailure() {
        sessionRef.current = null;
        setSession(null);
        setLocked(false);
        await clearSession();
      }
    });

    return () => configureAuthRefresh(null);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionRef.current && !locked && Date.now() - lastActivityRef.current >= LOCK_AFTER_MS) {
        setLocked(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [locked]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "background" || nextState === "inactive") {
        lastActivityRef.current = Date.now();
        return;
      }

      if (previousState !== "active" && nextState === "active" && sessionRef.current) {
        if (Date.now() - lastActivityRef.current >= LOCK_AFTER_MS) {
          setLocked(true);
        } else if (!locked) {
          lastActivityRef.current = Date.now();
        }
      }
    });

    return () => subscription.remove();
  }, [locked]);

  function recordActivity() {
    if (!sessionRef.current || locked) return;
    lastActivityRef.current = Date.now();
  }

  async function persistSession(nextSession: AuthSession) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, nextSession.token),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextSession.refreshToken),
      SecureStore.setItemAsync(SESSION_USER_KEY, JSON.stringify(nextSession.user))
    ]);
  }

  async function clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_USER_KEY)
    ]);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      locked,
      recordActivity,
      lock() {
        if (sessionRef.current) setLocked(true);
      },
      async signIn(phone: string, pin: string) {
        const nextSession = await authApi.login(phone, pin);
        await persistSession(nextSession);
        sessionRef.current = nextSession;
        lastActivityRef.current = Date.now();
        setLocked(false);
        setSession(nextSession);
      },
      async setPinAndSignIn(phone: string, resetToken: string, newPin: string) {
        const nextSession = await authApi.setPinAndLogin(phone, resetToken, newPin);
        await persistSession(nextSession);
        sessionRef.current = nextSession;
        lastActivityRef.current = Date.now();
        setLocked(false);
        setSession(nextSession);
      },
      async unlock(pin: string) {
        const currentSession = sessionRef.current;
        if (!currentSession) throw new Error("Sign in again to continue.");
        await authApi.verifyPin(currentSession.token, pin);
        lastActivityRef.current = Date.now();
        setLocked(false);
      },
      async signOut() {
        const refreshToken = sessionRef.current?.refreshToken;
        sessionRef.current = null;
        setSession(null);
        setLocked(false);
        await clearSession();
        if (refreshToken) {
          await authApi.logout(refreshToken).catch(() => undefined);
        }
      }
    }),
    [initializing, locked, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
