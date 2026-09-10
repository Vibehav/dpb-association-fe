# Phase 2 — Auth

**Goal:** sign-in as four real screens with the full error routing from integration doc §10,
and an `AuthContext` that owns tokens and the app-lock — and nothing else.

**Delivered with phase 1.** Introducing React Navigation forced the split: porting the
five-steps-in-one-`useState` `LoginScreen` onto the new stack, only to replace it, would have
been wasted work.

---

## 1. What was decided

| Topic | Decision |
|---|---|
| Role storage | **The role is never persisted.** `AuthContext` holds tokens + lock state; name and role come from `GET /me` via `useMe()`. |
| Session storage | One SecureStore key, `dpb.session`, holding a single JSON blob. Restore is then all-or-nothing. |
| Cold start | Always comes back **locked**. Tokens are still good; the PIN is re-asked. |
| Lock timeout | 5 minutes of inactivity. Spec §3 leaves it open; nothing on the server dictates it. |
| The PIN | **Never written to disk**, in any form. |
| Reset token | Held in navigation params, in memory only. |
| New-PIN confirm step | **None**, matching the prototype and §2.2. A typo is recoverable through "Forgot M-PIN?". Worth revisiting — see §6. |
| Auto-submit | In the keypad's `onChange` handler, guarded by `busy`. **Not** a `useEffect` on `pin.length`. |

---

## 2. `AuthContext` — `src/auth/AuthContext.tsx`

```ts
type StoredSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;   // epoch ms, from the pair's expiresInSeconds
  phone: string;                  // the signed-in number, for display on Account
};

type AuthStatus = "loading" | "signedOut" | "locked" | "ready";
```

Exposes `status`, `phone`, `signIn`, `completePinSetup`, `unlock`, `lock`, `signOut`,
`recordActivity`.

Constants: `LOCK_AFTER_MS` 5 min · `EXPIRY_SKEW_MS` 60 s · `ACTIVITY_CHECK_MS` 30 s.

The live session lives in a **ref** as well as state, because the HTTP client reads it from
outside React's lifecycle.

### Why the role isn't here

Integration doc §2.3 and spec §13.2 #7 both call this out, and the pre-refactor code got it
wrong: it persisted `user.role` from the login response and never refreshed it. The API
re-derives the role from the database on *every* request, so a demotion is meant to land on the
member's next screen. Keeping a copy on the device defeats that. Proved end to end in
[08 §5](08-verification.md#5-role-gating).

### The unlock path is the interesting one

`POST /auth/verify-pin` needs a *usable* access token, but it sits under the API's public
`/auth/**` matcher. Before the API fix in [09 §2](09-api-defects.md), an expired token there
produced a 500 rather than a clean 401.

```
unlock(pin):
  1. no session          → status signedOut, throw
  2. token expiring soon → forceRefresh(); if that fails the session is genuinely gone
  3. verifyPin(pin)
  4. on error:
       wrong_pin / pin_locked  → rethrow. NEVER retried — a retry burns a
                                 second attempt against the 5-attempt lockout.
       401 or 5xx otherwise    → the token was stale after all: forceRefresh once,
                                 then retry the PIN. Safe, because that failure
                                 happens before the PIN is ever checked.
```

Step 2 is why `accessTokenExpiresAt` is stored at all.

---

## 3. Screens — `src/features/auth/`

`AuthShell` gives every step the same frame: logo, the **association's own name**
(`ASSOCIATION_NAME` in `src/config.ts`), and a **fixed** "Committee sign-in" subtitle. Steps
used to override that subtitle, so the PIN screen read "Welcome back, Ishwar" where the design
keeps it constant — see [10 §9](10-design-review-fixes.md).

| Screen | Does | Routes on |
|---|---|---|
| `PhoneScreen` | `POST /auth/phone`, **debounced as the number is typed** | `onCommittee: false` → silent while typing, message on Continue · `pinSet: true` → Pin · `pinSet: false` → request a `FIRST_LOGIN` OTP, then Otp |
| `PinScreen` | `signIn()` | `pin_not_set` → request `FIRST_LOGIN` OTP, go to Otp · `not_on_committee` → back to Phone · `wrong_pin` / `pin_locked` → clear, show message, offer reset |
| `OtpScreen` | `POST /auth/otp/verify` | success → NewPin with the reset token · any failure → clear and show the message |
| `NewPinScreen` | `completePinSetup()` | `invalid_reset_token` → back to Otp with "that took too long" |
| `UnlockScreen` | `unlock()` | `wrong_pin` shown, session-ended handled by context |

`PhoneScreen` requests the first-login OTP **before** navigating.

> ⚠️ **Removed / superseded wording:** “so the user isn't staring at empty dots waiting for an
> SMS that hasn't been asked for.” OTPs are now delivered by email; the OTP screen shows the
> masked email hint. See [15-email-otp.md](15-email-otp.md).

It also greets live: once ten digits are in, the lookup runs and shows "Welcome back, X" in
green (prototype `authGreeting`). That greeting is what confirms the right number was typed,
so it has to appear *before* Continue — which then reuses the cached result. `firstName` is
therefore no longer threaded through the Pin and Otp route params.

`OtpScreen` has a 60-second resend cooldown matching the server's `app.otp.resend-throttle`, so
the button is disabled rather than letting the user earn a `429 otp_throttled`.

### Error routing implemented (integration doc §10)

| Code | Status | Handling |
|---|---|---|
| `wrong_pin` | 401 | Clear the field, "Wrong M-PIN", offer reset. **Never retried.** |
| `pin_locked` | 423 | "Locked after too many attempts. Try again later or reset your M-PIN." |
| `pin_not_set` | 409 | Route into the first-login OTP flow |
| `not_on_committee` | 404 | "This number isn't on the committee" |
| `otp_invalid` / `otp_expired` / `otp_attempts_exhausted` | 400 | Clear the code, show the server's message |
| `otp_throttled` | 429 | Resend disabled with a live countdown |
| `invalid_reset_token` | 401 | Back to the OTP step |
| `unauthorized` / `invalid_token` | 401 | Client refreshes once, else back to sign-in |

---

## 4. `useMe` and `usePermissions`

```ts
useMe()            // enabled only when status === "ready"
usePermissions()   // { role, loading, canRead, canWrite, isAdmin, canViewAadhaar, canManageCommittee }
```

`usePermissions` denies everything while `/me` is in flight, so a write button never flashes
into view for a viewer. It hides controls; it secures nothing — the API enforces the same rules
and answers 403 regardless (spec §13.1: assume a modified client).

`useMe` is disabled while locked, partly because it's pointless and partly because the access
token may already be expired on that screen — the unlock flow rotates it first.

---

## 5. Fixed from the pre-refactor code

- **Double-submit.** `UnlockScreen` guarded its auto-submit with `loading`; `LoginScreen` did
  not, so a fourth digit typed during a slow request could fire `login()` twice. All auto-submit
  now happens inside the keypad's change handler behind a `busy` guard.
- **6-digit OTP on a 4-digit keypad.** `PinDots` hardcoded four, so the OTP step used a plain
  `TextInput`. `CodeDots` and `Keypad` now take a length.
- **Dev leftovers.** A hardcoded `8451963620` on the phone step (where the API-URL note had been
  commented out) and "In development, the OTP is printed in the backend terminal as DEV OTP" on
  the OTP step.
- **Error codes discarded.** Everything in §3's table was previously indistinguishable, because
  the client threw a bare `Error(message)`.

---

## 6. Open question

**Should the new-PIN screen have a confirm step?** It is single-entry today, matching the
prototype and §2.2. A typo means the member is locked out and must do the whole OTP cycle again.
Recoverable, but a confirm step is the near-universal convention for a 4-digit code entered
blind. Not changed unilaterally, because the design is explicit.

---

## 7. Verification

Driven against a live API by a Node harness over the real `src/api` modules
([08 §2](08-verification.md#2-auth-and-the-client)):

```
first-login OTP → pin/set → token pair     expiresInSeconds 2700 (45 min)
GET /me                                    {id, name, role: "ADMIN"}
one wrong PIN                              1 request, failed_pin_attempts 0→1
wrong PIN error                            ApiError 401 wrong_pin
correct PIN                                204, counter cleared
refresh rotation                           new pair, onTokensRefreshed fired once
replaying the old refresh token            ApiError 401 invalid_refresh
access token after rotation                still valid
```

The `0→1` line is the one that matters: the old client sent **two** requests per wrong PIN, so
the server counted two and the 5-attempt lockout tripped on the third wrong entry. See
[09 §1](09-api-defects.md).
