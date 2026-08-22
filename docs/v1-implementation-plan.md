# V1 Implementation Plan — Market Association Record App (React Native)

Derived from `docs/frontend-integration.md` (the API contract and v1 scope line) and
`docs/Market Association Record App/` (the functional spec and the visual prototype).

**The scope line, restated:** v1 is **auth, Shops, People, Account, Committee**. Everything
about money — dashboard figures, Events, Fund, collection, receipts, fee cycle, cash handover,
statements, cancelled receipts — is v2 with no API behind it. This plan builds only v1 and
actively removes the v2 UI that currently exists on mock data.

---

## 0. Decisions and assumptions

These are calls made so the plan is actionable. Flag any you disagree with and I'll revise.

| # | Decision | Why |
|---|---|---|
| 0.1 | **Keep and extend the existing auth layer**; do not rewrite. | Phone → PIN → OTP → set-PIN, SecureStore persistence, and the single-flight 401→refresh in `client.ts` are correct and match §2. Everything else gets restructured around them. |
| 0.2 | **Delete the v2 money UI outright** rather than leave "coming soon" cards. | §0 permits either. Deleting removes `mockData.ts` (fabricated ₹ figures that read as real) and keeps the tab bar honest. Nothing is lost — the design is preserved in the prototype. |
| 0.3 | **v1 tab bar = Shops · Home · People** (3 tabs), Account from the initials top-right. | §5 says the v1 bar is "effectively Shops · People · Home", and spec §5 wants Home centered. With Events/Fund gone, centering Home means this order. |
| 0.4 | **React Navigation** (native-stack + bottom-tabs). | §1 recommends it, and every unbuilt v1 screen (shop detail, member profile, forms, committee) is a *pushed* screen. Current `useState` tab switching cannot express that. This is the gating dependency. |
| 0.5 | **TanStack Query** for all server state. | §1 recommends it, and §2.3's "rights and data are re-derived from the server on every screen" is exactly refetch-on-focus + invalidate-after-mutation. |
| 0.6 | **No `react-native-reanimated` / `@gorhom/bottom-sheet` in v1.** Multi-field flows use native-stack modal screens; destructive confirms use a small in-house `Sheet` on RN `Modal`. | The design asks for bottom sheets; native modal presentation plus a 60-line sheet gets ~95% of it without a Reanimated babel plugin and native rebuild. Revisit in v2. |
| 0.7 | **`react-hook-form` + hand-written validators**, no zod. | §8's rules are a short fixed list that must mirror the server exactly; a `validators.ts` keyed to §8 is easier to audit against the doc than a schema layer. |
| 0.8 | **Load Instrument Serif + IBM Plex Mono** via `expo-font`. | The prototype's character is the serif headings and mono numerals. `theme/typography.ts` already declares them but nothing loads them, so no `fontFamily` is applied anywhere today. |
| 0.9 | **Role comes from `GET /me` only**, never from the persisted session. | §2.3 and spec §13.2 #7. `AuthContext` shrinks to tokens + lock state; role moves to a `useMe()` query. |
| 0.10 | Target the API as written in §5/§7. Where the spec and the doc disagree, **the doc wins**. | e.g. spec §4.1 has a `floor` field and §4.4 has a "Worker" role; neither exists in the v1 API. Omit both. |

---

## 1. Dependencies

```bash
# navigation
npx expo install @react-navigation/native @react-navigation/native-stack \
  @react-navigation/bottom-tabs react-native-screens

# server state + forms
npm i @tanstack/react-query react-hook-form

# media (presigned PUT + compression before upload)
npx expo install expo-file-system expo-image-manipulator

# type fidelity
npx expo install expo-font @expo-google-fonts/instrument-serif @expo-google-fonts/ibm-plex-mono
```

Already present and used as-is: `expo-secure-store`, `expo-image-picker`,
`react-native-safe-area-context`, `@expo/vector-icons`.

`react-native-gesture-handler` is **not** required — native-stack doesn't need it and we're not
using the JS stack or a gesture-driven sheet.

Dev-only, added in Phase 8:

```bash
npm i -D jest jest-expo @testing-library/react-native @testing-library/jest-native
```

---

## 2. Target structure

```
src/
  app/
    providers.tsx            # QueryClientProvider + AuthProvider + SafeArea + fonts gate
    queryClient.ts           # retry policy, focusManager wiring, global error handling
  api/
    errors.ts                # ApiError (status + code), ErrorCode union, isCode()
    client.ts                # fetch wrapper: token provider, timeout, refresh, typed throw
    types.ts                 # wire types, 1:1 with integration doc §7
    authApi.ts  meApi.ts  shopsApi.ts  peopleApi.ts
    linksApi.ts  committeeApi.ts  mediaApi.ts
  auth/
    AuthContext.tsx          # tokens + lock ONLY (no role, no user profile)
    usePermissions.ts        # derived from useMe(): { isAdmin, canWrite, canViewAadhaar }
  features/
    shops/     hooks.ts  screens/  sheets/  components/
    people/    hooks.ts  screens/  sheets/  components/
    committee/ hooks.ts  screens/  sheets/
    account/   screens/
    home/      hooks.ts  screens/
  media/
    upload.ts                # pick → compress → presign → PUT → key
    useImageCapture.ts
  navigation/
    types.ts                 # typed param lists
    RootNavigator.tsx  AuthStack.tsx  AppStack.tsx  MainTabs.tsx
  components/
    ui/                      # Button Card Chip Sheet Field Avatar SearchBox
                             # EmptyState ErrorState ListFooter Confirm Toast
    search/                  # PersonSearchSheet, ShopSearchSheet (the duplicate guard)
  hooks/
    useRefreshOnFocus.ts  useDebouncedValue.ts
  theme/                     # colors (keep) + fonts + spacing + typography (wire up)
  utils/
    format.ts  phone.ts  validators.ts  deviceActions.ts
```

**Deleted:** `src/mockData.ts`, `src/screens/money/*`, `src/screens/committee/CommitteePlaceholder.tsx`,
`src/api.ts` (the loose barrel), `Dashboard` / `EventSummary` types, `Shop.feeStatus` / `Shop.feeDue`.

---

## 3. Phase 1 — Foundation

Nothing else can be built correctly until this lands. ~2–3 days.

### 3.1 Typed errors (`api/errors.ts`)

Today `client.ts` throws `new Error(message)`, discarding both the HTTP status and the machine
`code`. That makes §10's mapping table unimplementable and, concretely, makes `409 pin_not_set`
(must route into first-login OTP), `423 pin_locked`, and `401 wrong_pin` indistinguishable.

```ts
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}
export const isCode = (e: unknown, ...codes: string[]) =>
  e instanceof ApiError && codes.includes(e.code)
```

`ErrorCode` union enumerates every code in §10 so the compiler catches typos at call sites.

### 3.2 Client rewrite (`api/client.ts`)

Keep the existing single-flight refresh — it's the part usually gotten wrong and it's right.
Add:

- `setAuthTokenProvider(() => string | null)` so feature APIs stop threading `token` through
  every call (essential once calls live inside query hooks).
- Throw `ApiError` with `status` + `code` parsed from `{ code, message }`; fall back to a
  synthetic code when the body isn't the standard envelope.
- `AbortController` timeout (20s default) — §10 "always assume patchy network".
- Query-string builder that **omits** empty/undefined params (today `query=` is always sent).
- Never attempt refresh for `/auth/*` paths.
- On refresh failure: clear tokens → `AuthContext` drops to the number screen.

### 3.3 Query client (`app/queryClient.ts`)

- `retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status < 500)` — never
  retry a 4xx.
- Wire `focusManager` to RN `AppState` so returning from background refetches.
- `useRefreshOnFocus()` hook on React Navigation's `useFocusEffect` → refetch on screen focus.
  This is the mechanism behind §2.3's re-derivation rule; every screen uses it.
- Global mutation `onError`: `403` → toast "You don't have permission for this"; `401` handled
  by the client.
- Invalidate `['me']` on every screen focus so a mid-session demotion surfaces immediately.

### 3.4 Navigation skeleton

```
RootNavigator
├─ initializing            → SplashScreen
├─ no tokens               → AuthStack   (Phone → Pin → Otp → NewPin)
├─ tokens + locked         → UnlockScreen
└─ tokens + unlocked       → AppStack
                              ├─ MainTabs (Shops · Home · People)
                              ├─ ShopDetail, ShopForm(modal)
                              ├─ PersonProfile, MemberForm(modal)
                              ├─ Account, Committee
                              └─ AadhaarViewer(modal, admin)
```

Fully typed param lists in `navigation/types.ts`. Header carries the initials avatar → `Account`.

### 3.5 UI kit + theme

Migrate `components/ui/styles.ts` (384 lines of one flat StyleSheet) into composable primitives.
Wire `theme/spacing.ts` and `theme/typography.ts`, which are currently written but unused. Keep
`theme/colors.ts` unchanged — it already matches the prototype exactly.

`Keypad` and `PinDots` become **length-parameterised** (`length={4}` / `length={6}`) so the OTP
screen uses the design's keypad instead of today's fallback `TextInput`.

**Exit criteria:** app boots, fonts load, sign-in still works end-to-end, `tsc --noEmit` clean,
a deliberate 409 from any endpoint surfaces as an `ApiError` with the right `code`.

---

## 4. Phase 2 — Auth hardening

~1 day. The flow works; these are the gaps against §2.

| Item | Change |
|---|---|
| Error routing | `409 pin_not_set` → jump into `FIRST_LOGIN` OTP. `423 pin_locked` → "Locked after too many attempts — try later or reset PIN". `401 wrong_pin` → clear field, show "Wrong PIN", offer reset. `429 otp_throttled` → "Please wait before requesting another code" + disable resend with a countdown. |
| Split screens | One `LoginScreen` holding five steps in local state becomes `PhoneScreen` / `PinScreen` / `OtpScreen` / `NewPinScreen` on the auth stack, so back navigation is real. |
| Double-submit | `UnlockScreen` guards its auto-submit with `loading`; `LoginScreen` does not — a 4th digit during a slow request fires `login()` twice. Add the guard to all three auto-submit effects. |
| OTP keypad | 6 dots + keypad per §2.2 / prototype, replacing the `TextInput`. |
| Reset token | Keep `resetToken` in memory only (already correct — do not regress this into SecureStore). |
| `AuthContext` slims | Stores `{ accessToken, refreshToken }` + lock state. `user`/`role` removed; `GET /me` becomes the only source. |
| Dev leftovers | Remove the hardcoded `8451963620` on the phone step and "the OTP is printed in the backend terminal as DEV OTP" on the OTP step. Gate both behind `__DEV__` if still useful locally. |
| Lock behaviour | Keep as-is: 5-min inactivity timer, `AppState` handling, cold start restores **locked**. Matches §2.3. |

**Exit criteria:** every row of §10 that touches auth produces its specified UX; PIN is never
written to disk; a removed committee member gets "This number isn't on the committee".

---

## 5. Phase 3 — Domain layer

~1–1.5 days. Wire types in `api/types.ts`, 1:1 with §7 — no invented fields, no lossy mapping.

Three bugs to fix while writing it:

1. **`mediaApi`** sends `type: "MEMBER_PHOTO"` / `"BILL_PHOTO"`. §6 defines
   `PHOTO | AADHAAR_FRONT | AADHAAR_BACK`. Today's values would 400 on first real use, and
   `BILL_PHOTO` is v2 anyway.
2. **`shopsApi`** derives `floor` from `tenancy === "OPEN_STALL"`. `tenancy` is only
   `OWNER_RUN | RENTED_OUT` and v1 has no `floor` field, so every shop renders "Market".
   Drop `floor`; surface `tenancy` (currently discarded).
3. **`Shop.feeStatus` / `feeDue`** are v2. Remove from the type and the card (§5.2: "No fee chip
   in v1").

Full v1 surface to cover:

```
auth      POST /auth/phone · /auth/login · /auth/otp/request · /auth/otp/verify
          POST /auth/pin/set · /auth/token/refresh · /auth/logout · /auth/verify-pin
me        GET  /me
shops     GET  /shops?query&lane&page&size · GET /shops/{id}
          POST /shops · PATCH /shops/{id} · DELETE /shops/{id}
          POST /shops/{id}/links · POST /shops/{id}/transfer
links     DELETE /links/{linkId}
people    GET  /people?query&role&page&size · GET /people/{id}
          POST /people · PATCH /people/{id} · POST /people/{id}/links · DELETE /people/{id}
          GET/PUT /people/{id}/photo · GET /people/{id}/aadhaar/{side} · PUT /people/{id}/aadhaar
media     POST /media/upload-url
committee GET/POST /committee · PATCH /committee/{id}
          POST /committee/{id}/reset-pin · DELETE /committee/{id}
```

Query keys: `['me']`, `['shops', filters]`, `['shop', id]`, `['people', filters]`,
`['person', id]`, `['committee']`, `['person', id, 'aadhaar', side]`.

`validators.ts` mirrors §8 exactly — 10-digit phone, 4-digit PIN, 6-digit OTP, trimmed
non-blank shop number / business name / name, `consent === true`, photo + Aadhaar front
required for a new member, link role ∈ `{RENTER, STAFF}`.

`usePermissions()` reads `useMe()` and returns `{ isAdmin, canWrite, canViewAadhaar }` per §3's
capability table. Server stays authoritative; this only hides controls.

---

## 6. Phase 4 — Media pipeline

~1.5 days. Build this **before** the People screens — §12 build order, and the member form can't
submit without it.

`media/upload.ts` exposes one function:

```ts
uploadImage(type: 'PHOTO'|'AADHAAR_FRONT'|'AADHAAR_BACK', localUri: string): Promise<string /* key */>
```

1. Compress first via `expo-image-manipulator` — resize to ~1600px long edge, JPEG q0.7. A raw
   phone camera Aadhaar shot is 4–8 MB; uploading that over market-grade signal is the difference
   between a 2-second save and a timeout.
2. `POST /media/upload-url { type }` → `{ key, uploadUrl, expiresInSeconds }`. Fetch this
   **late** — §6 warns the URL expires in ~5 min, so don't presign at form-open.
3. `PUT` the bytes with `expo-file-system`'s `uploadAsync` +
   `FileSystemUploadType.BINARY_CONTENT`, `Content-Type: image/jpeg`, **no auth header**.
   (Plain `fetch(uri).then(r => r.blob())` is unreliable across RN engines for large local files;
   `uploadAsync` streams from disk and is the dependable path for a presigned PUT.)
4. Return `key`. The caller puts it in `photoKey` / `aadhaarFrontKey` / `aadhaarBackKey`, or in a
   retake `PUT`.

`useImageCapture()` wraps `expo-image-picker` (camera + library), tracks
`idle | capturing | uploading | done | failed` per slot, and offers retry. A failed upload must
never silently leave the form looking complete.

**Exit criteria:** capture → compress → upload → key round-trips against the real backend/MinIO;
an expired upload URL re-presigns and retries once; a failed upload blocks submit with a clear
message.

---

## 7. Phase 5 — Shops

~3–4 days. §5.2–5.5.

### 7.1 Shops list — `GET /shops?query&lane&page&size`

- `useInfiniteQuery`; `getNextPageParam` from `page` / `totalPages`. Never fetch the whole list —
  1,024 shops.
- Count line reads **`totalElements`**, not the loaded array length. Today it says "50 shops
  shown" out of 1,024, which reads as a total.
- Debounced search (350ms) → `query` (matches shop number, business name, or any linked person's
  name/phone).
- Lane chips → `lane`. **There's no distinct-lanes endpoint**, so: "All" + chips derived from
  lanes seen in loaded pages, plus a free-text lane filter. Noted in §11 as a candidate backend
  addition (`GET /shops/lanes`).
- Card from `ShopListItemResponse`: `shopNumber`, `businessName`, `lane`, `licenceHolderName`
  (or "Licence holder not added yet"), `rentedToName` → "Rented to …", `staffCount`. **No fee
  chip.**
- `+ Register new shop` for admin/collector only.
- Empty / error / offline states as distinct renders — **no mock fallback**. Today
  `MainTabs.loadData()` catches any list failure and swaps in `shopsMock`, so one dropped request
  shows five invented shops as if they were the register.

### 7.2 Shop detail — `GET /shops/{id}`

- Header: `shopNumber` · `businessName` · `lane`; when `formerHolderName` is present,
  "Previously: {name} · licence held till {formerHolderTill}". **Edit** for admin/collector.
- **People at this shop:** `people[]` ordered owner → renter → staff, each row initials + name +
  phone + role at this shop, tapping through to the profile.
- Actions: `+ Add person to this shop` (§7.4), `Transfer licence` (admin), `Delete shop` (admin,
  confirm sheet stating it unlinks everyone).
- Fee card and "Earlier years" omitted (v2).

### 7.3 Register shop — `POST /shops`

Two steps, matching the design:

1. Shop form: `shopNumber`, `businessName`, `lane`, `tenancy` (`OWNER_RUN | RENTED_OUT`).
2. Licence holder: **pick an existing member** (via `PersonSearchSheet`) or **add a new person**
   → the member form runs as "step 2 of 2" and returns a `newPerson` payload.

```json
{ "shopNumber": "A-31", "businessName": "…", "lane": "Lane 2", "tenancy": "OWNER_RUN",
  "owner": { "existingPersonId": "<uuid>" } }
```

**Key structural point:** the new-owner branch must **not** `POST /people`. The member form needs
a second mode that hands its payload back to the caller for embedding in `owner.newPerson` (and
in `transfer.newPerson`). Designing `MemberForm` with `mode: 'submit' | 'return'` from the start
avoids a painful retrofit — this single decision touches registration, transfer, and add-member.

`409 duplicate_shop_number` → inline field error, "A shop with this number already exists".

### 7.4 Edit / links / transfer / delete

- **Edit** → `PATCH /shops/{id}` sending **all four** fields (§5.3). 409 on a taken number.
- **Add person** → `PersonSearchSheet` → `POST /shops/{id}/links { role, existingPersonId }`,
  role choices **RENTER / STAFF only**. `409 renter_exists` → "This shop already has a renter";
  `409 already_linked` → "Already linked here".
- **Transfer licence** (admin) → `POST /shops/{id}/transfer` with
  `{ existingPersonId }` or `{ newPerson }`, plus optional `tillDate` (defaults today). The sheet
  must state, before confirming, that past contributions stay with the former holder and the old
  owner is replaced. Response is the updated `ShopDetailResponse`.
- **Delete** (admin) → `DELETE /shops/{id}`, confirm sheet.
- Every mutation invalidates `['shops']` + `['shop', id]` + any touched `['person', id]`.

**Exit criteria:** register → detail → edit → add renter → add staff → transfer → delete runs
against the real backend; the one-owner rule is unbreakable from the UI (no "remove owner"
anywhere); pagination holds at 1,000+ shops.

---

## 8. Phase 6 — People

~4–5 days. The largest phase. §5.6–5.8.

### 8.1 The search-first add sheet — `components/search/PersonSearchSheet.tsx`

Build this first; it's the highest-value unbuilt piece in v1. Both `+ Add person to this shop`
and `+ Add a member` open a **search sheet, never a blank form** (§5.7, spec §7.3): type a name
or number → `GET /people?query=` → matches with phone and existing shops → link one. Only when
nothing matches does "Not on record — create new" open the form.

At 2,300 people this is the difference between one profile per worker and two half-profiles with
split contribution histories. Today both buttons are `onPress={() => {}}`.

Reused by four call sites: add-person-to-shop, add-member, registration owner picker, transfer.
A sibling `ShopSearchSheet` does the same for linking a shop from a profile, excluding
already-linked shops.

### 8.2 People list — `GET /people?query&role&page&size`

Infinite query, debounced search (name / phone / shop number), role chips
`All | OWNER | RENTER | STAFF`. Row from `PersonListItemResponse`: initials avatar, `name`,
`phone`, and `shops[]` with roles. Lifetime-given total, last contribution and the **Collect**
action are all omitted (v2); **History** opens the profile. `+ Add a member` for admin/collector.

### 8.3 Member form — `POST /people`

```json
{ "person": { "name": "…", "phone": "9820000000", "whatsappPhone": "9820000000",
              "address": "…", "photoKey": "<key>", "aadhaarFrontKey": "<key>",
              "aadhaarBackKey": "<key?>", "aadhaarLast4": "1234?", "consent": true },
  "links": [ { "shopId": "<uuid>", "role": "STAFF" } ] }
```

- Field order per spec §7.2: name → photo → role → linked shop (searchable, `+ Link another
  shop & role`) → phone → WhatsApp (same-as-phone toggle) → address → Aadhaar front/back +
  optional last 4 → consent tick → footer showing who is capturing and when.
- **Validation order, one plain message at a time** (spec §7.2): name → 10-digit phone → at least
  one shop with a role → photo → Aadhaar front → consent.
- **At least one link is required, and only `RENTER` / `STAFF`.** An `OWNER` link here is a 400 —
  owners exist only via registration or transfer (§5.8, §9).
- Live **duplicate-phone warning** while typing via `GET /people?query=<phone>`; `409
  duplicate_phone` on save → inline error.
- `whatsappPhone` defaults to `phone` when omitted; `consent` must be `true`.
- Both modes from §7.3 (`submit` for standalone, `return` for shop-create / transfer).

### 8.4 Member profile — `GET /people/{id}`

- Header: name, roles/shops, **Edit** (admin/collector).
- **Photo:** render `photoUrl` from the profile response directly (it's already a short-lived
  signed URL — no need to call `GET /people/{id}/photo` except to refresh after a retake).
  **Retake** → capture → upload → `PUT /people/{id}/photo { key }`.
- **Shops & roles:** one row per link, tap → shop. `+ Link another shop & role` →
  `POST /people/{id}/links { shopId, role }` (RENTER/STAFF). Unlink renter/staff →
  `DELETE /links/{linkId}` (admin). Render the "No shop linked" state (§9 — reachable once the
  last link is removed, even though it can't be created that way).
- **Details:** phone, WhatsApp, address, "Added on {addedOn} · by {addedByName}". **Call** →
  dialer; **WhatsApp** → `wa.me/91<number>` (`utils/deviceActions.ts`).
- **Aadhaar panel** — the strictest rule in the app (§9, spec §4.3):
  - **Admin:** `GET /people/{id}/aadhaar/FRONT` (and `/BACK`) → `{ url }` → show. Every view is
    logged server-side. `PUT /people/{id}/aadhaar { side, key }` to re-capture.
  - **Collector / Viewer:** blurred, locked placeholder, "Aadhaar is visible to the admin only".
    **Do not call the endpoint** — it returns 403. Collectors may still re-capture, never view.
  - `aadhaarLast4` + capture info shown to everyone.
  - Signed-URL queries get short `staleTime`/`gcTime` and are never persisted.
- **Edit** → `PATCH /people/{id} { name, phone, whatsappPhone, address }`, 409 on dup phone.
- **Delete** (admin) → `DELETE /people/{id}` (soft, unlinks).
- Contribution history and "Record a contribution" omitted (v2).

**Exit criteria:** add member (with photo + Aadhaar upload) → list → profile → edit → link second
shop → unlink → retake photo → delete, all against the real backend. As a collector, the Aadhaar
GET is never issued — verify in the network log, not just the UI.

---

## 9. Phase 7 — Account, Committee, Home

~2–3 days.

### 9.1 Account (§5.9)

- Identity from `GET /me` (name, role) + the signed-in number from auth state.
- **Change M-PIN** → reuses the OTP flow: `otp/request PIN_RESET` → `otp/verify` → `pin/set`.
- **Sign out** → `POST /auth/logout { refreshToken }`, then clear SecureStore.
- **Your rights** — static plain-language text per role, from §3's capability table.
- Admin only: **Committee members & roles**.
- Omitted (v2): Cash with you, Cash handovers, Cancelled receipts, Annual fee cycle, Reports,
  Association settings backend bits. A static association identity block may stay.

### 9.2 Committee (admin) — `/committee` (§5.10)

- List → `GET /committee` → `[{ id, name, phone, role, active, pinSet, removedAt }]`. Active
  first; `active=false` rows greyed with "Removed {removedAt}".
- Add → `POST /committee { name, phone, role }`. Copy must say "they'll set a PIN on first
  sign-in" — the admin never types a PIN. 409 on duplicate number. Include the plain description
  of what each role can do (spec §6.13).
- Change role → `PATCH /committee/{id} { role }`. Reset PIN → `POST /committee/{id}/reset-pin`
  (they're signed out and must set a new PIN). Remove → `DELETE /committee/{id}` (soft).
- **Guards arrive as 400** — `self_action` (can't change/remove yourself) and `last_admin`
  (can't remove/demote the last admin). Show the server's `message`; additionally hide the
  controls on your own row.
- No collection figures here (spec §6.13).
- `committeeApi` already exists and is unused — it needs the `type` fixes from Phase 3 and its
  screens.

### 9.3 Home (§5.1)

Deliberately thin — there is no dashboard endpoint in v1.

- Shop and people counts from `totalElements` of `GET /shops?size=1` and `GET /people?size=1`.
- Quick entry points to Shops and People; for admins, Committee via Account.
- **Nothing else.** No fund balance, event cards, pending collections, or top contributors.

### 9.4 v2 teardown

Delete `mockData.ts`, `screens/money/FundScreen.tsx`, `screens/money/EventsScreen.tsx`,
`CommitteePlaceholder.tsx`, the `Dashboard` / `EventSummary` types, `Shop.feeStatus` / `feeDue`,
and the mock fallback in `MainTabs`. Drop the Fund and Events tabs.

---

## 10. Phase 8 — Hardening, QA, tests

~2–3 days.

### 10.1 Automated tests

| Target | Why it's on the list |
|---|---|
| `client.ts` refresh | Single-flight under concurrent 401s; rotated pair persisted; refresh failure → signed out. Highest-risk code in the app. |
| `ApiError` mapping | Every §10 code parses to the right `{status, code}`. |
| `validators.ts` | Each §8 rule, including the RENTER/STAFF-only link role. |
| `media/upload.ts` | Compress → presign → PUT → key; expired-URL retry; failure blocks submit. |
| Permission gating | Snapshot each screen per role; assert the Aadhaar GET is never issued as collector/viewer. |
| Auth step routing | `pin_not_set` → OTP, `pin_locked` → locked copy, `wrong_pin` → clear + reset offer. |

### 10.2 Manual QA matrix

Run every screen as **admin**, **collector**, **viewer**:

- Viewer sees no `+ Register new shop`, no `+ Add a member`, no Edit, no Transfer, no Delete.
- Collector sees register/add/edit but no Transfer, no Delete, no Aadhaar image, no Committee.
- Admin sees everything.
- **Mid-session demotion:** admin demotes a collector on device B; device A's next screen focus
  reflects it (spec §13.2 #7).
- **Removed member:** cannot sign in; `POST /auth/phone` returns `onCommittee=false`; the number
  can be re-added.
- **Patchy network:** airplane-mode mid-save shows a clear failure and a retry, never a false
  success (§10, spec §13.4).
- Touch targets ≥ 44px (spec §13.4) — collectors use this one-handed, standing.
- Phone rendering `+91 XXXXXXXXXX`, dates `DD MMM YYYY`, times in IST.

---

## 11. Sequencing

Rough, single developer. Phases 1–3 are strictly serial; 5 and 6 can overlap once 4 lands.

| Phase | Work | Est. |
|---|---|---|
| 1 | Foundation: errors, client, query, navigation, UI kit, fonts | 2–3 d |
| 2 | Auth hardening | 1 d |
| 3 | Domain layer: wire types, API modules, validators, permissions | 1–1.5 d |
| 4 | Media pipeline | 1.5 d |
| 5 | Shops: list, detail, register, edit, links, transfer, delete | 3–4 d |
| 6 | People: search sheet, list, member form, profile, Aadhaar | 4–5 d |
| 7 | Account, Committee, Home, v2 teardown | 2–3 d |
| 8 | Tests + QA matrix | 2–3 d |
| | **Total** | **~17–23 d** |

Order follows §12's suggested build order, with one change: **the media pipeline moves ahead of
the People screens** rather than sitting inside them, because the member form cannot submit
without a working key-producing upload.

Demoable checkpoints: after Phase 2 (auth complete on real nav), after Phase 5 (shops
end-to-end), after Phase 7 (v1 feature-complete).

---

## 12. Questions — resolved against the API repo

The backend's own slice docs (`dpb-association-api/docs/v1/01`–`05`) settled almost all of
these. Answers below are from those docs and the source, not assumptions.

| # | Question | Answer |
|---|---|---|
| 12.1 | Lane chips — is there a lanes endpoint? | **No, and there won't be.** api slice 1: "No wings, no floors, no managed lane list" — `lane` is free-text `varchar(120)`, filtered by `lower(lane)`. Derive chips from loaded pages plus a free-text filter. |
| 12.2 | Spec §4.4's **Worker** role? | **Dropped.** api slice 1: "The spec's 'Worker' was identical to Staff and was dropped." Roles are `OWNER \| RENTER \| STAFF` only. |
| 12.3 | Spec §4.1's **Floor** field? | **Doesn't exist.** Not in the `shop` table. The old client faked it from `tenancy`, so every shop read "Market". Omitted. |
| 12.4 | App-lock timeout? | Server-agnostic. Kept at 5 min. |
| 12.5 | Two devices on one number? | **Supported.** api slice 2: refresh tokens are per-device and rotate independently. |
| 12.6 | Shopless members? | Still barred at creation (`POST /people` needs ≥1 link), but api slice 3 confirms soft-deleting a shop leaves people "No shop linked" — so the state must render. |
| 12.7 | Photos in the people list? | No photo on `PersonListItemResponse`. Initials avatars, matching the prototype. |
| 12.8 | Shop with no licence holder? | **Cannot happen.** api slice 1: "A shop **always** has exactly one owner (overrides the spec's 'temporarily no owner')." Transfer is atomic. Don't build a "Licence holder not added yet" flow — keep only a defensive fallback. |
| 12.9 | Can `POST /shops/{id}/links` create a new person inline? | **Yes** — `AddLinkRequest{ role, existingPersonId?, newPerson? }`. The add-person-to-shop sheet can create as well as link. |
| 12.10 | What do the write endpoints return? | Confirmed in the controllers: every shop mutation returns `ShopDetailResponse`; every person mutation returns `PersonProfileResponse`; media PUTs return 204. |
| 12.11 | Timings and limits | Access token 45 min · refresh 30 days, rotated · presigned URLs 5 min · PIN lockout 5 attempts / 15 min · OTP resend throttle 60s · page size default 20, max 100. |

### Still genuinely open

| # | Question | Phase |
|---|---|---|
| A | Should the new-PIN screen have a **confirm** step? The prototype and §2.2 show single entry, so that's what's built — but a typo means a full OTP reset cycle. | 2 (built as designed) |
| B | README's backend path is `/home/vaibhav/Projects/dpb-association-api` (a teammate's machine) and its file guide now describes the pre-refactor tree. | housekeeping |

---

## 13. Invariants — do not regress these

Pulled from §9, §13.1 and spec §13.2, because each one already broke once in prototyping or is
explicitly called out in the doc:

1. **A shop always has exactly one owner.** No "remove owner" control exists anywhere. Owner
   changes only via Transfer licence.
2. **≤1 owner, ≤1 renter, many staff.** A person holds at most one role per shop.
3. **Link roles from any add flow are `RENTER` or `STAFF` only** — never `OWNER`.
4. **Never call the Aadhaar GET as a non-admin.** Not gated-and-called; not called at all.
5. **Role is re-derived from `GET /me` on every screen focus**, never read from a stored login
   response.
6. **No mock or cached fallback for register data.** A failure renders as a failure.
7. **Never let a save appear to succeed when it didn't.** There is no offline mode.
8. **The PIN is never written to disk.** Tokens go to SecureStore; the PIN stays in memory.
9. **Presigned URLs are fetched late and used immediately** — they expire in ~5 minutes.
10. **Pagination everywhere.** ~1,000 shops and ~2,300 people never ship to the phone in full,
    and counts come from `totalElements`.
11. **If it isn't in `frontend-integration.md`, it's v2** — leave it out rather than invent an
    endpoint.

---

---

## 14. Build record and defect log — moved

This file is the **plan**: the decisions (§0), the phase breakdown (§3–§10), the resolved
questions (§12) and the invariants (§13).

The **record of what was actually built**, phase by phase, now lives in **[`docs/v1/`](v1/)**
so there is one source of truth rather than two:

| | |
|---|---|
| [`v1/README.md`](v1/README.md) | Index, current status, delivery order vs. plan order |
| [`v1/01-foundation.md`](v1/01-foundation.md) | Errors, client, query cache, navigation, UI kit, theme, v2 teardown |
| [`v1/02-auth.md`](v1/02-auth.md) | `AuthContext`, the four sign-in screens, app-lock, §10 routing |
| [`v1/03-domain.md`](v1/03-domain.md) | Wire types, API modules, validators, permissions |
| [`v1/04-media.md`](v1/04-media.md) | Compress → presign → PUT → key |
| [`v1/05-shops.md`](v1/05-shops.md) | Shops, and the duplicate guard |
| [`v1/06-people.md`](v1/06-people.md) | People, and the Aadhaar panel |
| [`v1/07-account-committee.md`](v1/07-account-committee.md) | Change M-PIN, committee management |
| [`v1/08-verification.md`](v1/08-verification.md) | Every result — **and what is not covered** |
| [`v1/09-api-defects.md`](v1/09-api-defects.md) | Three findings in the API, all resolved |

**Status:** phases 1–7 complete; v1 is feature-complete. Phase 8 (§10 of this plan) and a device
pass as a non-admin remain — see [`v1/08-verification.md` §7](v1/08-verification.md#7-what-is-not-covered).
