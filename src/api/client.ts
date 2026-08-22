/**
 * The single HTTP entry point for the app.
 *
 * Responsibilities:
 *  - attach the bearer token (pulled from an injected provider, so feature APIs don't
 *    thread a `token` argument through every call site)
 *  - time out rather than hang on patchy signal
 *  - throw `ApiError` carrying the HTTP status and the machine `code`
 *  - refresh-and-retry once on a 401 from a protected endpoint, single-flighted
 */

import { ApiError, apiErrorFromBody } from "./errors";

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1"
).replace(/\/$/, "");

/** Default request timeout. The market has patchy signal; hanging forever is worse. */
const DEFAULT_TIMEOUT_MS = 20_000;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
};

type ClientHooks = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  /** Persist a rotated pair. Refresh tokens rotate on every use, so this must not be skipped. */
  onTokensRefreshed: (tokens: TokenPair) => Promise<void>;
  /** Refresh failed — the session is gone. Clear storage and return to sign-in. */
  onSessionExpired: () => Promise<void>;
};

let hooks: ClientHooks | null = null;
let refreshInFlight: Promise<string | null> | null = null;

/** Wired once by `AuthProvider`. Passing null tears the wiring down. */
export function configureClient(next: ClientHooks | null) {
  hooks = next;
  if (!next) refreshInFlight = null;
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Plain object — serialised to JSON per attempt, so a retry re-sends it safely. */
  body?: unknown;
  /** Empty, null and undefined values are omitted rather than sent as `key=`. */
  query?: QueryParams;
  /** Set false for the public `/auth/*` endpoints. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const withAuth = options.auth !== false;
  const token = withAuth ? hooks?.getAccessToken() ?? null : null;

  let response = await send(path, options, token);

  // A 401 from a protected endpoint always means the access token is unusable, so it is
  // safe to refresh and replay. A 401 from `/auth/*` means something else entirely —
  // `wrong_pin`, `invalid_refresh`, `invalid_reset_token` — and replaying it would both
  // fail again and, for `verify-pin`, burn a second wrong-PIN attempt against the
  // server's 5-attempt lockout. Never retry those.
  if (response.status === 401 && withAuth && !isPublicAuthPath(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send(path, options, refreshed);
  }

  return parse<T>(response);
}

function isPublicAuthPath(path: string) {
  return path.startsWith("/auth/");
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Tracked with a flag rather than an abort reason: React Native's AbortController is a
  // polyfill that ignores `abort(reason)`, and `DOMException` isn't reliably defined on
  // Hermes — constructing one here would throw a ReferenceError instead of timing out.
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onCallerAbort);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_BASE_URL}${path}${queryString(options.query)}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
  } catch (caught) {
    // `fetch` rejects for DNS/socket failures and for our own abort. Neither produced an
    // envelope, so synthesise one the UI can branch on. A caller-initiated cancellation
    // is re-thrown untouched — React Query treats it as a cancellation, not a failure.
    if (options.signal?.aborted) throw caught;
    throw timedOut
      ? new ApiError(0, "timeout", "Request timed out.")
      : new ApiError(0, "network_error", "Network request failed.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    if (!response.ok) throw apiErrorFromBody(response.status, "");
    return undefined as T;
  }

  const text = await response.text();

  if (!response.ok) throw apiErrorFromBody(response.status, text);
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, "unknown", "The server returned an unreadable response.");
  }
}

function queryString(query?: QueryParams) {
  if (!query) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Rotate the token pair. Single-flighted: a burst of parallel 401s (a screen firing
 * several queries at once) performs exactly one refresh and they all replay with the
 * same new token.
 */
function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = hooks?.getRefreshToken();
    if (!refreshToken) {
      await hooks?.onSessionExpired();
      return null;
    }

    try {
      const response = await send("/auth/token/refresh", { method: "POST", body: { refreshToken } }, null);
      const tokens = await parse<TokenPair>(response);
      await hooks?.onTokensRefreshed(tokens);
      return tokens.accessToken;
    } catch (caught) {
      // A network blip must not destroy a valid session — only an actual rejection of
      // the refresh token does. Signing the user out on a dropped packet would be a
      // miserable experience in a market basement.
      if (caught instanceof ApiError && caught.isNetworkFailure) return null;
      await hooks?.onSessionExpired();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Force a token rotation and return the new access token.
 *
 * Needed by the app-unlock flow: `POST /auth/verify-pin` is a bearer endpoint that sits
 * under the public `/auth/**` matcher, so an expired access token there does not produce
 * a clean 401 we could refresh on — see `AuthContext.unlock`.
 */
export async function forceRefresh(): Promise<string | null> {
  return refreshAccessToken();
}
