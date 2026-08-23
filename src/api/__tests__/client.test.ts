/**
 * The highest-risk code in the app: token attachment, the refresh single-flight, and the
 * rules about when a 401 may and may not be replayed.
 *
 * The `/auth/*` test is the one that matters most. Before it existed, the client replayed
 * every 401 after a refresh — including `POST /auth/verify-pin`, which answers
 * `401 wrong_pin` and increments a committed failed-attempt counter. Each wrong PIN was
 * therefore counted twice and the 5-attempt lockout tripped on the third try. If someone
 * ever "simplifies" `isPublicAuthPath` away, that test fails.
 */

import { API_BASE_URL, configureClient, forceRefresh, request } from "../client";
import { ApiError } from "../errors";

type Hooks = Parameters<typeof configureClient>[0];

const REFRESH_PATH = "/auth/token/refresh";

/** Minimal stand-in for Response — the client only reads ok/status/text(). */
function res(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body))
  } as unknown as Response;
}

/** Await a request expected to reject, narrowed to ApiError. */
async function rejects(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (caught) {
    if (caught instanceof ApiError) return caught;
    throw caught;
  }
  throw new Error("expected the request to reject, but it resolved");
}

const pair = {
  accessToken: "new-access",
  refreshToken: "new-refresh",
  tokenType: "Bearer",
  expiresInSeconds: 2700
};

let fetchMock: jest.Mock;
let hooks: {
  onTokensRefreshed: jest.Mock;
  onSessionExpired: jest.Mock;
};

/** URLs of every fetch call, in order. */
const calls = () => fetchMock.mock.calls.map((c) => String(c[0]));
const initOf = (n: number) => fetchMock.mock.calls[n][1] as RequestInit;
const authHeader = (n: number) => (initOf(n).headers as Record<string, string>).Authorization;

function wire(tokens: { access?: string | null; refresh?: string | null } = {}) {
  hooks = { onTokensRefreshed: jest.fn(async () => {}), onSessionExpired: jest.fn(async () => {}) };
  configureClient({
    getAccessToken: () => (tokens.access === undefined ? "access-1" : tokens.access),
    getRefreshToken: () => (tokens.refresh === undefined ? "refresh-1" : tokens.refresh),
    ...hooks
  } as Hooks);
}

beforeEach(() => {
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  wire();
});

afterEach(() => configureClient(null));

describe("request", () => {
  it("attaches the bearer token and hits the configured base URL", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: "1" }));
    await expect(request("/me")).resolves.toEqual({ id: "1" });

    expect(calls()[0]).toBe(`${API_BASE_URL}/me`);
    expect(authHeader(0)).toBe("Bearer access-1");
  });

  it("omits the token when auth is false", async () => {
    fetchMock.mockResolvedValueOnce(res(200, {}));
    await request("/auth/phone", { method: "POST", body: { phone: "9" }, auth: false });
    expect(authHeader(0)).toBeUndefined();
  });

  it("drops empty, null and undefined query params", async () => {
    fetchMock.mockResolvedValueOnce(res(200, {}));
    await request("/shops", { query: { query: "", lane: undefined, role: null, page: 0, size: 20 } });
    // page=0 must survive — 0 is a real value, not an absence.
    expect(calls()[0]).toBe(`${API_BASE_URL}/shops?page=0&size=20`);
  });

  it("resolves undefined for 204", async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await expect(request("/people/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("serialises the body per attempt so a replay is safe", async () => {
    fetchMock.mockResolvedValueOnce(res(200, {}));
    await request("/shops", { method: "POST", body: { shopNumber: "A-1" } });
    expect(initOf(0).body).toBe('{"shopNumber":"A-1"}');
  });
});

describe("errors", () => {
  it("throws ApiError carrying the status and machine code", async () => {
    fetchMock.mockResolvedValueOnce(res(409, { code: "renter_exists", message: "This shop already has a renter" }));
    const error = await rejects(request("/shops/1/links", { method: "POST", body: {} }));

    expect(error.status).toBe(409);
    expect(error.code).toBe("renter_exists");
    expect(error.message).toBe("This shop already has a renter");
  });

  it("degrades gracefully when the body is not our envelope", async () => {
    // Spring Boot's default error body has no `code` field.
    fetchMock.mockResolvedValueOnce(res(500, { timestamp: "…", status: 500, error: "Internal Server Error" }));
    const error = await rejects(request("/shops"));

    expect(error.code).toBe("unknown");
    expect(error.status).toBe(500);
    expect(error.message).toMatch(/server/i);
  });

  it("reports a network failure as status 0 without ending the session", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    const error = await rejects(request("/shops"));

    expect(error.status).toBe(0);
    expect(error.code).toBe("network_error");
    expect(error.isNetworkFailure).toBe(true);
    // A dropped packet must never sign someone out.
    expect(hooks.onSessionExpired).not.toHaveBeenCalled();
  });
});

describe("401 handling", () => {
  it("refreshes once and replays the request with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401, { code: "unauthorized", message: "Authentication required" }))
      .mockResolvedValueOnce(res(200, pair))
      .mockResolvedValueOnce(res(200, { id: "1" }));

    await expect(request("/me")).resolves.toEqual({ id: "1" });

    expect(calls()).toEqual([`${API_BASE_URL}/me`, `${API_BASE_URL}${REFRESH_PATH}`, `${API_BASE_URL}/me`]);
    expect(hooks.onTokensRefreshed).toHaveBeenCalledWith(pair);
    // The replay must carry the rotated token, not the stale one.
    expect(authHeader(2)).toBe("Bearer new-access");
  });

  it("NEVER refreshes on a 401 from /auth/* — a replayed verify-pin double-counts the lockout", async () => {
    fetchMock.mockResolvedValueOnce(res(401, { code: "wrong_pin", message: "Incorrect PIN" }));

    const error = await rejects(request("/auth/verify-pin", { method: "POST", body: { pin: "0000" } }));

    expect(error.code).toBe("wrong_pin");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls()).not.toContain(`${API_BASE_URL}${REFRESH_PATH}`);
    expect(hooks.onTokensRefreshed).not.toHaveBeenCalled();
  });

  it("ends the session when the refresh token is rejected", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401, { code: "unauthorized", message: "…" }))
      .mockResolvedValueOnce(res(401, { code: "invalid_refresh", message: "Invalid refresh token" }));

    await request("/me").catch(() => {});
    expect(hooks.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the refresh itself fails on the network", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401, { code: "unauthorized", message: "…" }))
      .mockRejectedValueOnce(new TypeError("Network request failed"));

    await request("/me").catch(() => {});
    expect(hooks.onSessionExpired).not.toHaveBeenCalled();
  });

  it("ends the session immediately when there is no refresh token", async () => {
    wire({ refresh: null });
    fetchMock.mockResolvedValueOnce(res(401, { code: "unauthorized", message: "…" }));

    await request("/me").catch(() => {});
    expect(hooks.onSessionExpired).toHaveBeenCalledTimes(1);
    // No point asking the server to rotate a token we don't have.
    expect(calls()).not.toContain(`${API_BASE_URL}${REFRESH_PATH}`);
  });

  it("forceRefresh rotates on demand and hands back the new token", async () => {
    // AuthContext.unlock() calls this before verify-pin, because that endpoint sits under
    // the public /auth/** matcher and a stale token there doesn't yield a clean 401.
    fetchMock.mockResolvedValueOnce(res(200, pair));
    await expect(forceRefresh()).resolves.toBe("new-access");
    expect(hooks.onTokensRefreshed).toHaveBeenCalledWith(pair);
  });

  it("forceRefresh returns null and ends the session when the token is rejected", async () => {
    fetchMock.mockResolvedValueOnce(res(401, { code: "invalid_refresh", message: "…" }));
    await expect(forceRefresh()).resolves.toBeNull();
    expect(hooks.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("single-flights the refresh across concurrent 401s", async () => {
    // Two screens fire at once, both 401, then both replay — one rotation only.
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith(REFRESH_PATH)) return res(200, pair);
      const seen = calls().filter((c) => !c.endsWith(REFRESH_PATH)).length;
      return seen <= 2 ? res(401, { code: "unauthorized", message: "…" }) : res(200, { ok: true });
    });

    await Promise.all([request("/shops"), request("/people")]);

    const refreshes = calls().filter((c) => c.endsWith(REFRESH_PATH));
    expect(refreshes).toHaveLength(1);
    expect(hooks.onTokensRefreshed).toHaveBeenCalledTimes(1);
  });
});
