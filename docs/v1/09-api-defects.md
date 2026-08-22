# API defects found while building the client

Three findings in `dpb-association-api`. One was a frontend bug the API's behaviour made
dangerous; two were server-side. All three are resolved.

Kept here rather than only in the API repo because each one shaped a client decision that would
look arbitrary otherwise.

---

## 1. Wrong M-PIN was counted twice (frontend, **fixed**)

**Symptom:** the 5-attempt lockout tripped on the **third** wrong PIN.

The old `client.ts` retried any 401 after a token refresh, excluding only the refresh endpoint
itself:

```ts
if (response.status === 401 && token && path !== "/auth/token/refresh") { /* refresh + retry */ }
```

`POST /auth/verify-pin` is a bearer endpoint that answers **401 `wrong_pin`** for a wrong PIN.
And `AuthService.verifyPin` is annotated:

```java
@Transactional(noRollbackFor = ApiException.class)
```

— specifically so the failed-attempt increment **commits** even though the request then errors
(api slice 2 §7 documents that fix). So every wrong PIN on the unlock screen was sent twice and
counted twice.

**Fix:** never refresh-retry a `/auth/*` path. A 401 there means `wrong_pin`, `invalid_refresh`
or `invalid_reset_token` — none of which a replay can help, and one of which a replay actively
harms.

**Verified:** one wrong PIN → 1 HTTP request, `failed_pin_attempts` 0→1.

**Do not undo** by broadening the retry condition. If a future endpoint under `/auth/**` needs
refresh-and-retry, special-case that path rather than removing the guard.

---

## 2. Every unhandled error was rewritten as `401 unauthorized` (API, **fixed**)

**Symptom:** a 404, a 405, a malformed body and a genuine 500 were all indistinguishable from
"your token is bad".

```
POST /auth/phone with malformed JSON   expected 400   actual 401 unauthorized
GET  /api/v1/does-not-exist            expected 404   actual 401 unauthorized
GET  /api/v1/auth/phone (wrong method) expected 405   actual 401 unauthorized
```

**Mechanism.** `GlobalExceptionHandler` covers `ApiException`, `AccessDeniedException` and
`MethodArgumentNotValidException`. Anything else goes uncaught, so the servlet container performs
an **ERROR dispatch to `/error`**. Spring Security 6's `AuthorizationFilter` filters *all*
dispatcher types by default, so that re-enters the chain; `/error` matches neither
`/api/v1/auth/**` nor `/actuator/health`, falls through to `anyRequest().authenticated()`, and —
being anonymous — hits the `authenticationEntryPoint`, which **overwrites the original status and
body**.

The tell was the response header: `Content-Type: application/json;charset=ISO-8859-1`, which is
the hand-written `response.getWriter().write(...)` in `SecurityConfig`, not a Jackson response.

**Why it mattered for the client.** This client reacts to a 401 on a protected route by rotating
tokens and replaying. So a server-side 500 became a pointless refresh followed by "Please sign in
again", and any real bug in the shops or people code would have been near-impossible to diagnose
from the app.

**Fix applied in the API:**

```java
.authorizeHttpRequests(auth -> auth
        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()   // ← added first
        .requestMatchers("/api/v1/auth/**").permitAll()
        …)
```

**Verified after:** malformed JSON → 400, wrong method → 405.

**Still worth doing:** the uncovered cases now return **Boot's default error body**, which has no
`code` field, so the client falls back to `"unknown"` and cannot branch. Adding handlers for
`HttpMessageNotReadableException` (400), `NoResourceFoundException` (404),
`HttpRequestMethodNotSupportedException` (405) and a catch-all `Exception` (500 `server_error`)
would close that. **Not yet done.**

**Note:** an unknown path still returns 401 for an unauthenticated caller, and that is correct —
revealing which paths exist to an anonymous caller would be worse.

**A note on how this was diagnosed.** My first report claimed `verify-pin` returned a 500. It
returned a clean 401, because of this masking, so the report was wrong in its *symptom*. Chasing
the discrepancy is what found the real bug — and once the masking was fixed, the 500 in §3
appeared exactly as originally predicted.

---

## 3. `POST /auth/verify-pin` NPE'd on a null principal (API, **fixed**)

**Symptom, once §2 was fixed:** a 500 whenever the access token was missing or expired.

```
java.lang.NullPointerException: Cannot invoke
  "in.dpbmandal.api.security.AuthPrincipal.userId()" because "principal" is null
    at in.dpbmandal.api.auth.controller.AuthController.verifyPin(AuthController.java:74)
```

**Mechanism.** Four things combined:

1. `SecurityConfig` marks `/api/v1/auth/**` as `permitAll()` — it must, so sign-in works without
   a token.
2. `verify-pin` is the one endpoint under that path that needs to know *who* is asking, and reads
   `@AuthenticationPrincipal AuthPrincipal principal`.
3. `JwtAuthFilter` never rejects by design — on a missing, expired or version-stale token it
   returns and calls `filterChain.doFilter` anyway, leaving the context unauthenticated.
   Rejection is authorization's job.
4. But authorization permitted the path, so the request reached the controller with no
   authentication, `principal` bound to `null`, and `principal.userId()` threw.

**Reachable in normal use:** the access token lives 45 minutes and the app locks after 5 minutes
idle, so any lock outliving the token landed here.

**Fix applied in the API** — authorization now owns it:

```java
.requestMatchers(HttpMethod.POST, "/api/v1/auth/verify-pin").authenticated()
.requestMatchers("/api/v1/auth/**").permitAll()
```

**Matchers are evaluated in order, first match wins**, so the specific rule must stay *above*
the wildcard. With this in place `@AuthenticationPrincipal` is guaranteed non-null and no
defensive check is needed in the controller.

**Verified:**

| Request | Result |
|---|---|
| no token | `401 unauthorized` |
| garbage bearer | `401 unauthorized` |
| valid token, wrong PIN | `401 wrong_pin`, `failed_pin_attempts` 0→1 |
| valid token, correct PIN | `204`, counter cleared |
| `/auth/phone`, `/auth/login`, `/auth/logout` with no token | still public |
| `/me` with no token | still `401` |

### Why the two 401 codes matter

Both cases are 401, but they mean different things and the client branches on the code:

| Case | Status | Code | Client behaviour |
|---|---|---|---|
| No or stale token | 401 | `unauthorized` | Rotate the token, retry the PIN once |
| Valid token, wrong PIN | 401 | `wrong_pin` | Show it. **Never retry** — a retry burns a lockout attempt |

Before the fix the stale-token case surfaced as a 500 and `AuthContext.unlock` was inferring
rather than reading. It still treats a 5xx as a stale-token signal, which is harmless and useful
belt-and-braces: that failure happens before the PIN is ever checked, so retrying cannot cost an
attempt.
