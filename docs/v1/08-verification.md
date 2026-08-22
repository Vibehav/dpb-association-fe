# Verification

How v1 was proved, every result, and — more importantly for whoever picks this up — **what is
not covered.**

---

## 1. Method

There are no automated tests yet. Everything was verified by throwaway Node harnesses driving
**the real `src/api` modules** against a running API and a running MinIO.

That works because `src/api/*` imports nothing from React Native — only `./errors`, `./types`
(type-only) and global `fetch`. So the modules compile to CommonJS and run under Node:

```bash
./node_modules/.bin/tsc \
  src/env.d.ts src/api/*.ts \
  --outDir <scratch>/apitest --module commonjs --target es2022 \
  --moduleResolution node --skipLibCheck --strict false
```

Each harness then wires the client exactly as the app does and swaps sessions:

```js
let session = null;
configureClient({
  getAccessToken:    () => session?.accessToken ?? null,
  getRefreshToken:   () => session?.refreshToken ?? null,
  onTokensRefreshed: async (t) => { session = t },
  onSessionExpired:  async () => { session = null }
});
```

**Why this and not mocked unit tests:** it exercises the real envelopes, the real status codes
and the real business rules, so an assumption about the API cannot silently pass. It found three
API defects ([09](09-api-defects.md)) and corrected several of my own wrong assumptions. What it
does **not** do is run in CI or survive this session — which is what phase 8 is for.

The harnesses lived in the session scratchpad, not the repo. Recreating one takes minutes; the
results below are the record.

Preconditions: API on `localhost:8080`, Postgres + MinIO up, seeded admin `8451963620` with a
known PIN, and dev seed data (6 shops, 13 people).

---

## 2. Auth and the client

```
first-login OTP → pin/set → token pair    expiresInSeconds 2700 (45 min)
bearer injected from the provider          GET /me → {id, name, role:"ADMIN"}
GET /shops?size=1, /people?size=1          ShopListItem / PersonListItem exact,
                                           incl. rentedToName: null
ONE wrong PIN                              1 request; failed_pin_attempts 0→1
wrong PIN error                            ApiError 401 wrong_pin
correct PIN                                204; counter cleared to 0
refresh rotation                           new pair; onTokensRefreshed fired once;
                                           token changed
replaying the old refresh token            ApiError 401 invalid_refresh
access token after rotation                still valid
```

Error envelopes parsed into `ApiError` with the right code: `401 unauthorized`,
`401 invalid_refresh`, `400 validation_error`, `403 forbidden`, `404 *_not_found`,
`409 duplicate_*`, `423 pin_locked`.

**The `0→1` line is the whole point.** The pre-refactor client sent two requests per wrong PIN,
so the server counted two and the 5-attempt lockout tripped on the *third* wrong entry.

---

## 3. Media

```
presign PHOTO                → key photos/f25c8831…   ttl 300s
PUT to storage (no auth)     → HTTP 200, 50,077 bytes
PUT /people/{id}/photo {key} → 204
GET /people/{id}/photo       → signed url, ttl 300s
download                     → HTTP 200, 50,077 bytes
sha256 up == sha256 down     → PASS  (3d9017d6c4a059e0…)
GET /people/{id}             → photoUrl served inline
```

**On real hardware** (`S3_ENDPOINT` pointed at the LAN address): `aadhaar_access_log` showed
three `RECAPTURE` → `VIEW` pairs milliseconds apart. Attached objects measured **89,274 bytes**
(photo) and **104,165 bytes** (Aadhaar front), both `image/jpeg` — the expected range for 1600px
at q0.7 from a phone camera.

That run is what proved `manipulateAsync`, `expo/fetch` with a `File` body, the picker and
permissions, none of which a Node harness can touch.

---

## 4. Shops (28) and People (26)

Full tables in [05 §7](05-shops.md#7-verification) and [06 §7](06-people.md#7-verification).
Every invariant from integration doc §9 that those screens can touch is covered, including:

```
exactly one owner per shop            ≤1 renter per shop
one role per person per shop          OWNER not addable via add-link
OWNER not removable                   transfer stamps former holder + date
soft delete frees the number/phone    duplicate detection is case-insensitive
"No shop linked" state reachable      pagination maths correct
```

Both harnesses clean up after themselves; the register was confirmed back at its 6-shop /
13-person baseline afterwards.

---

## 5. Role gating

The last real risk, and the reason it was worth creating throwaway committee members. A test
COLLECTOR and VIEWER were created, their PINs set through the real first-login OTP flow, and the
same client driven with each session. **29 of 29.**

| | Collector | Viewer |
|---|---|---|
| `GET /shops`, `/people`, profile, photo | allowed | allowed |
| `POST /media/upload-url` | allowed | **403** |
| `POST /shops`, `PATCH /shops/{id}` | allowed | **403** |
| `PATCH /people/{id}`, `PUT …/photo` | allowed | **403** |
| `PUT …/aadhaar` (re-capture) | allowed | **403** |
| `GET …/aadhaar/{side}` (view) | **403** | **403** |
| `DELETE /shops/{id}` | **403** | **403** |
| `POST /shops/{id}/transfer` | **403** | **403** |
| `DELETE /links/{linkId}` | **403** | **403** |
| `GET /committee` | **403** | **403** |

Three results worth naming:

**A collector may re-capture an Aadhaar image and still cannot read it back.** `PUT` allowed,
`GET` 403 — same session, same person, seconds apart. The strictest rule in the app (spec §4.3)
proven rather than assumed.

**Mid-session demotion lands on the next request.** An admin changed the collector to VIEWER
from another session; the collector's *original, unexpired* access token then reported
`role: VIEWER` and its next write was refused. No re-login, no refresh. That is spec §13.2 #7 —
the thing that broke during the API's prototyping — working end to end, and it is the reason the
client never persists a role.

**Reset-PIN ends a session immediately.** The collector's live token returned
`401 unauthorized`, the client's refresh was rejected, and `onSessionExpired` cleared the stored
session — the exact path that drops the app back to the number screen.

Both test accounts were removed afterwards. They persist as `active: false` rows, because a
removal keeps its history by design; purge them from the dev database if the roster gets noisy.

---

## 6. Static checks

- `npm run typecheck` (`tsc --noEmit`) clean after every phase.
- `npx expo install --check` → "Dependencies are up to date" — all eleven added packages are
  SDK-54 compatible.

---

## 7. What is **not** covered

Read this section before trusting the numbers above.

### No automated tests at all

Nothing above runs in CI or survives a `git clone`. Phase 8's list, in priority order:

| Target | Why it's first |
|---|---|
| `client.ts` refresh | Single-flight under concurrent 401s; rotated pair persisted; network blip must **not** sign out; `/auth/*` never retried. Highest-risk code in the app. |
| `ApiError` mapping | Every code in §10 parses to the right `{status, code}`; Boot's non-envelope body degrades sensibly. |
| `validators.ts` | Each §8 rule, including RENTER/STAFF-only links and the §7.2 ordering. |
| `media/upload.ts` | Compress → presign → PUT → key; the 403-only retry; failure yields no key. |
| Permission gating | Component snapshots per role, and an assertion that the Aadhaar GET is **never issued** as a collector or viewer. |
| Auth step routing | `pin_not_set` → OTP, `pin_locked` → locked copy, `wrong_pin` → clear + reset offer. |

Suggested tooling: `jest-expo` + `@testing-library/react-native` (listed in the plan's §1 but
not installed).

### No device pass as a non-admin

The harnesses prove the **server refuses** things. Only a phone proves the **buttons are
hidden**. Nobody has yet signed in as a collector or a viewer on a device and checked that
"Register new shop", "Add a member", Edit, Transfer, Delete and the Committee row are absent
rather than present-and-403ing.

To do it: add a collector and a viewer from the Committee screen, read their first-login OTPs
from the API console, set PINs, and walk every screen. That also exercises phase 7's add flow.

### Other gaps

- **UI-only logic is unverified**: debounce behaviour, infinite-scroll edge cases, the sticky
  action bars, `ConfirmSheet` copy, keyboard avoidance on the long member form.
- **The dev media harness has not been removed.** `src/features/dev/` plus its `AppStack` and
  Account registrations should go once the member form has been exercised on device.
- **No accessibility pass.** Roles and labels are set throughout, but nothing has been driven
  with a screen reader.
- **`last_admin` cannot be tested** — see [07 §6](07-account-committee.md#6-note-last_admin-is-unreachable-through-the-api).
- **Orphaned media objects accumulate** — see [04 §8](04-media.md#8-gotchas).
- **Seed data was mutated during testing.** Ramesh Patil's photo and Aadhaar front are now the
  association logo. Harmless, but don't read it as real data.
