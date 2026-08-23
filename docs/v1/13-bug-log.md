# Bug log

Every client-side bug found during the v1 build, what caused it, how it was fixed, and whether
a test now guards it.

**Append to this file as new bugs are found.** One entry per bug. If there's no regression test,
say so — an unguarded fix is one refactor away from coming back.

Origin column: **inherited** = present in the code before this work · **introduced** = mine,
caught later · **contract** = the client was wrong about what the API does.

API-side defects live in [09-api-defects.md](09-api-defects.md).

---

## Severity 1 — silent data corruption or security

### B1 · A pasted `+91` number was stored corrupted `inherited` · **test: partly**

`PhoneField` did `digitsOnly(next).slice(0, 10)`.

```
paste "+91 9820000000"
  → digitsOnly  → "919820000000"   (12 digits)
  → slice(0,10) → "9198200000"     ← country code + first 8 real digits
```

`phone` is `varchar(10)`, unique among active rows, and is how a person is identified. So the
member was saved under a **wrong but perfectly valid-looking** number. Their real number stayed
free, so someone would register them again later — the split-profile problem the duplicate guard
exists to prevent, arriving through the back door. `maxLength={10}` made it worse by truncating
the paste before the handler ever saw the prefix.

**Fix:** `PhoneField` now calls `normalisePhone`, and `maxLength` is gone so the full paste
reaches the handler.

`normalisePhone` is covered by `src/utils/__tests__/phone.test.ts`. **The component wiring is
not** — nothing fails if someone swaps `normalisePhone` back for `digitsOnly` inside
`PhoneField`. A render test on that field would close the gap.

### B2 · `normalisePhone` turned typos into different valid numbers `inherited` · **test: yes**

It took "the last 10 digits of anything longer than 10":

```
"98200000001"  (11 — one digit too many)  →  "8200000001"   ← a different valid number
```

**Fix:** strip only **recognised prefixes at their exact lengths** — `0091`+10, `91`+10, `0`+10.
Anything else keeps its length and fails validation, which is the only safe outcome for a
unique identifying field.

### B3 · Aadhaar audit trail was recording views nobody asked for `introduced` · **test: partly**

`useAadhaarUrl` used React Query's defaults. With the panel open, once `staleTime` elapsed a
focus event silently re-requested the signed URL — and the server writes a `VIEW` row to
`aadhaar_access_log` **per request**. The audit log would have contained views the admin never
performed, which defeats the entire point of logging them.

**Fix:** `refetchOnMount`, `refetchOnWindowFocus` and `refetchOnReconnect` all false. The URL is
fetched only when a deliberate tap flips `enabled`.

`AadhaarPanel.test.tsx` asserts the endpoint isn't called on mount. **The focus-refetch half is
not covered** — simulating a stale-then-refocus cycle needs more machinery than it's worth
today, so the three `refetchOn*: false` flags are load-bearing and uninsured.

### B4 · The Aadhaar panel attributed the image to the wrong person `introduced` · **test: yes**

The panel rendered `Captured by {addedByName} · {addedOn}`. Those fields are the **member
record's** `created_by`/`created_at`, not the image's — api slice 4 reuses them deliberately
("no separate capturer field"). After a collector re-captured, the label still named whoever
created the member.

Confirmed live: the front image was Colin Collector's work at 20:09, and the panel would have
said "Captured by Ishwar".

**Fix:** label now reads "Member added by X · date" — truthful about what the field is. Real
capture attribution needs an API change; see [12 §1](12-open-gaps.md).

`AadhaarPanel.test.tsx` asserts the panel renders "Member added by …" and that no "Captured
by" text exists anywhere in it.

### B5 · A dropped packet could have signed the user out `inherited` · **test: yes**

The refresh path treated any failure as "the refresh token was rejected" and cleared the
session. On patchy signal — which the spec assumes throughout — that meant being logged out by
a lost packet.

**Fix:** `refreshAccessToken` only calls `onSessionExpired` on an actual rejection. An
`ApiError` with `status === 0` returns null and leaves the session intact.

---

## Severity 2 — wrong behaviour the user would notice

### B6 · One wrong M-PIN counted as two; lockout after 3 tries `inherited` · **test: yes**

The client replayed every 401 after a token refresh, excluding only the refresh endpoint. But
`POST /auth/verify-pin` answers `401 wrong_pin`, and `AuthService.verifyPin` is annotated
`@Transactional(noRollbackFor = ApiException.class)` **specifically so the failed-attempt
increment commits**. Every wrong PIN was therefore sent twice and counted twice, and the
5-attempt / 15-minute lockout tripped on the third wrong entry.

**Fix:** never refresh-retry a `/auth/*` path. Guarded by the most important test in the suite —
mutation-tested by reintroducing the bug and confirming that test alone goes red.

### B7 · The Home screen reloaded forever `introduced` · **test: yes**

`useRefreshOnFocus` listed its callback in the `useCallback` dependency array. `HomeScreen`
passes an inline arrow (it refetches two queries), which is a new function every render:

```
new function → new effect → refetch → state change → re-render → new function → …
```

Every other screen passed `query.refetch`, which React Query keeps stable — so only Home spun,
which is why it survived earlier testing. **Found on a device by the user.**

**Fix:** the hook holds the callback in a ref with **empty deps**. A caller must not have to
memoise to use it safely.

`useRefreshOnFocus.test.tsx` mocks `useFocusEffect` to re-subscribe on callback-identity change
— the real behaviour — then renders a component whose callback triggers a state update and
asserts the render count stays bounded. It also checks the first focus is skipped, a later
focus fires, and the ref doesn't go stale across a re-render.

### B8 · Deleting a member fired two `404`s every time `introduced` · **test: yes**

Visible in the API log as a pair of "Member not found" 13ms apart. Delete invalidated
`queryKeys.people.all`, and both the profile detail and any revealed Aadhaar URL are keyed
**beneath** it:

```
["people"]                                  ← invalidated
  ["people","detail",id]                    ← refetched → 404
  ["people","detail",id,"aadhaar","FRONT"]  ← refetched → 404
```

Two requests for a person who no longer existed, while the screen was still mounted.
**Found in the user's backend log.**

**Fix:** new `lists` query keys. Delete mutations invalidate `people.lists` / `shops.lists`
only, never the details. Same bug and fix for `useDeleteShop`.

`deleteInvalidation.test.tsx` seeds a real cache with a list, a detail and an Aadhaar URL, runs
the delete, and asserts the list is invalidated while the detail and Aadhaar are not.

### B9 · The register showed invented data when a request failed `inherited` · **test: no**

`MainTabs.loadData()` caught any list failure and substituted `shopsMock` / `peopleMock`. One
dropped request rendered five fabricated shops as though they were the register — against spec
§13.4, which requires that nothing look like it succeeded when it didn't.

**Fix:** `mockData.ts` deleted. Failures render as `ErrorState` with a retry.

### B10 · The role was cached from login and never refreshed `inherited` · **test: no**

`session.user.role` was persisted at sign-in and read from storage thereafter. The API
re-derives the role from the database on every request precisely so a demotion lands
immediately; caching it defeated that. Spec §13.2 #7 lists this as a thing that broke during
the API's own prototyping.

**Fix:** `AuthContext` holds tokens and lock state only. Role comes from `GET /me` via
`useMe()`, refetched on every screen focus. Verified end-to-end: a collector's *original*
access token reported `VIEWER` on its next request after an admin demoted them.

### B11 · Error codes were thrown away `inherited` · **test: yes**

The client threw `new Error(message)`, discarding the HTTP status and the machine `code`. That
made integration doc §10's routing table unimplementable — `409 pin_not_set` (must route into
first-login OTP), `423 pin_locked` and `401 wrong_pin` were indistinguishable.

**Fix:** `ApiError(status, code, message)` plus a 31-code list transcribed from the API's throw
sites. `src/api/__tests__/errors.test.ts`.

### B12 · Repeatedly refused renter links, with the error off-screen `introduced` · **test: no**

Four `409 renter_exists` in 27 seconds in the API log. Two causes in the profile's "Link another
shop": the sheet **displayed** `rentedToName` but still let you pick RENTER for a shop that had
one; and the sheet closed on tap, rendering the error as a banner far down a long scrolling
profile. Nothing appeared to happen, so the user retried.

**Fix:** rows whose `rentedToName` is set are disabled when the role is RENTER ("Already rented
to X — add as staff instead"), and the sheet stays open with its error in place until the link
succeeds.

### B13 · `dialerUrl` / `whatsAppUrl` doubled the country code `inherited` · **test: yes**

`` `https://wa.me/91${digitsOnly(value)}` `` → given a number already carrying `+91`, produced
`https://wa.me/91919820000000`. Not reachable today because the API returns bare digits, but one
bad value away from being.

**Fix:** both normalise first.

---

## Severity 3 — wrong output, no data consequence

| # | Bug | Origin | Fix | Test |
|---|---|---|---|---|
| B14 | `mediaApi` sent `MEMBER_PHOTO` / `BILL_PHOTO`; the API's enum is `PHOTO \| AADHAAR_FRONT \| AADHAAR_BACK`. Would have 400'd on first real use. | contract | Correct values | no |
| B15 | `shopsApi` invented `floor` from `tenancy === "OPEN_STALL"`. `tenancy` is only `OWNER_RUN \| RENTED_OUT` and v1 has **no floor column**, so every shop rendered "Market". | contract | Field removed | no |
| B16 | `Shop.feeStatus` / `feeDue` drove a fee chip. Fees are v2; §5.2 says "No fee chip in v1". | contract | Removed | no |
| B17 | ~46dp gap under every stack header — `Screen` applied the top safe-area inset a second time on top of the navigator's header. **Found on a device.** | introduced | Default `edges` excludes top | no |
| B18 | Auto-submit on the login screen had no in-flight guard, so a 4th digit during a slow request fired `login()` twice. | inherited | Submit moved into the keypad handler behind `busy` | no |
| B19 | `PinDots` hardcoded 4 dots, so the 6-digit OTP step fell back to a system `TextInput` and lost the designed keypad. | inherited | `CodeDots` takes a length | no |
| B20 | `titleCase("OWNER_RUN")` rendered "Owner Run". | introduced | `tenancyLabel()` uses the design's wording | yes |
| B21 | "Not on record — create new" only appeared after typing, so the pick sheet read as a dead end when you already knew the person wasn't registered. | introduced | Always visible beside Cancel, as the design has it | no |
| B22 | No keyboard avoidance; on iOS the keyboard covered the lower half of the 8-field member form. | introduced | `KeyboardAvoidingView` in `Screen` | no |
| B23 | "MEMBER PHOTO ·  REQUIRED" — double space. | introduced | — | no |
| B24 | Fonts declared in `theme/typography.ts` but never loaded, so no `fontFamily` applied anywhere. | inherited | `useAppFonts()` gates the app | no |
| B25 | Dev leftovers on the sign-in screen: a hardcoded phone number, and "the OTP is printed in the backend terminal". | inherited | Removed | no |
| B26 | Dead `authApi.refresh` — a second way to rotate tokens that bypassed the client's single-flight. | introduced | Removed | n/a |

---

## Caught before it ever ran

### B27 · `DOMException` doesn't exist on Hermes `introduced`

The first draft of the request timeout used
`controller.abort(new DOMException("timeout", "TimeoutError"))`. React Native's
`AbortController` is a polyfill that ignores `abort(reason)`, and `DOMException` isn't reliably
defined on Hermes — so instead of timing out, every timeout would have thrown a
`ReferenceError`. Caught while reviewing before the first device run.

**Fix:** track the timeout with a boolean flag.

---


## Regression coverage

97 tests across 10 suites (`npm test`, ~2s). What each guards:

| Suite | Guards |
|---|---|
| `api/__tests__/client.test.ts` | **B6** (mutation-tested), **B5**, **B11** |
| `api/__tests__/errors.test.ts` | **B11** — all 31 codes, envelope parsing, Boot's body degrading |
| `utils/__tests__/phone.test.ts` | **B2**, **B13**, and B1's underlying function |
| `utils/__tests__/validators.test.ts` | every §8 rule |
| `utils/__tests__/format.test.ts` | **B20**, plus the IST conversion |
| `media/__tests__/validation.test.ts` | the failed-vs-missing image distinction |
| `hooks/__tests__/useRefreshOnFocus.test.tsx` | **B7** |
| `features/people/__tests__/deleteInvalidation.test.tsx` | **B8** |
| `auth/__tests__/usePermissions.test.ts` | the gating flags every screen reads |
| `features/people/__tests__/AadhaarPanel.test.tsx` | **B4**, half of **B3**, and the never-call-it-as-a-non-admin invariant |

### Still unguarded — the remaining liability

| # | Why it's uncovered |
|---|---|
| **B1** (component wiring) | `normalisePhone` is tested; nothing fails if `PhoneField` stops calling it. Needs a render test on the field. |
| **B3** (focus refetch) | Mount is covered; the stale-then-refocus path isn't. The three `refetchOn*: false` flags are load-bearing and uninsured. |
| **B17** (safe-area) | Layout. Needs a snapshot, which nobody has asked for. |
| **B22** (keyboard) | Same — `KeyboardAvoidingView` presence isn't meaningfully assertable without a snapshot. |
| **B9, B10, B12** | Architectural (no mock fallback, no persisted role, error placement). A test would assert the absence of something, which tends to rot. |

### Notes on the shape of this list

- **Ten of these were inherited**, and most were only findable by reading the API source
  alongside the client — B6 in particular needed `noRollbackFor` in `AuthService` to make sense.
- **Three were found by the user on a device** (B7, B8, B17) and one in the backend log (B12).
  No amount of static reasoning surfaced them; running the app did.
- **Three were found by the test suite within minutes of it existing** (B1, B2, B13), all in the
  same file, all about phone numbers.
- **Two tests are worth more than the rest combined**: the `/auth/*` replay guard in
  `client.test.ts`, and the non-admin Aadhaar assertions. Both protect rules with real
  consequences — a lockout at three tries, and an Aadhaar image reaching someone who may not
  see it.
