export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8080/api/v1";

type TokenPairResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
};

type AuthRefreshHandlers = {
  getRefreshToken: () => string | null;
  onRefresh: (tokens: TokenPairResponse) => Promise<void>;
  onRefreshFailure: () => Promise<void>;
};

let authRefreshHandlers: AuthRefreshHandlers | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function configureAuthRefresh(handlers: AuthRefreshHandlers | null) {
  authRefreshHandlers = handlers;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && token && path !== "/auth/token/refresh") {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      headers.set("Authorization", `Bearer ${refreshedToken}`);
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
      });
      return parseResponse<T>(retryResponse);
    }
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(errorMessage(text, response.status));
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function errorMessage(text: string, status: number) {
  if (!text) return `Request failed with ${status}`;

  try {
    const parsed = JSON.parse(text) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    return text;
  }

  return text;
}

async function refreshAccessToken() {
  if (!authRefreshHandlers) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = authRefreshHandlers?.getRefreshToken();
      if (!refreshToken) return null;

      try {
        const tokens = await request<TokenPairResponse>("/auth/token/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken })
        });
        await authRefreshHandlers?.onRefresh(tokens);
        return tokens.accessToken;
      } catch {
        await authRefreshHandlers?.onRefreshFailure();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}
