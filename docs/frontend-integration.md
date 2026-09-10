# Frontend Integration Guide — React Native (v1)

This document is the **context handoff for building the React Native app** against the v1
backend. It maps the app's design (screens/flows) to the **actual v1 API**, states the
business rules the UI must respect, and calls out exactly which parts of the design are **v1
(build now)** vs **v2 (do not wire yet — the endpoints don't exist)**.

Read this end-to-end before writing screens. It is written to minimize wrong assumptions:
prefer what's here over guessing an endpoint or a rule.

---

## 0. TL;DR for the agent

- **Build only v1 features:** sign-in, Shops register/manage, People register/manage,
  Account, and (admin) Committee management. Everything about **money** — Home dashboard
  figures, Events, Fund, Collection form, Receipt, Cash handover, Fee cycle, Statements,
  Cancelled receipts — is **v2 and has no API yet**. Don't build or stub calls for them; if a
  design screen is money-related, either omit it or show a "coming soon" placeholder.
- **Base URL:** `http://<host>:8080/api/v1`. All JSON. Auth via `Authorization: Bearer <accessToken>`.
- **Roles:** `ADMIN`, `COLLECTOR`, `VIEWER` — from `GET /me`. Gate UI by role, but the
  server is the source of truth (it returns 403 if a role isn't allowed). Re-fetch `/me` and
  list data on screen focus so a role change/removal reflects quickly.
- **Images:** never upload bytes to our API. Get a presigned URL, `PUT` the file straight to
  storage, then send the returned **key** in the person payload.
- **Aadhaar:** admin-only to view; collectors capture but can never view it again. Enforce in
  UI, but the server enforces too (403).

---

## 1. Recommended stack (adjust to your preference)

- **React Native** (Expo is fine).
- **Navigation:** React Navigation — bottom tabs + native stack for pushed screens; bottom
  sheets for destructive/multi-field actions (matches the design).
- **Data fetching:** TanStack Query (React Query). It gives caching, `refetchOnFocus`, and
  easy invalidation — which is exactly how we honor "rights and data are re-derived from the
  server on every screen." Use query invalidation after mutations.
- **HTTP:** a thin `fetch`/`axios` wrapper with interceptors (attach bearer; refresh on 401).
- **Secure storage:** `expo-secure-store` or `react-native-keychain` for the refresh token
  (and access token). Never store the PIN on device.
- **Forms:** react-hook-form + a small validation layer mirroring the server rules below.
- **Camera/media:** `expo-image-picker` / `expo-camera` to capture photos and Aadhaar images.

---

## 2. Auth & session model

Sign-in is **phone number + 4-digit M-PIN**. The number decides the role. Tokens are JWTs:
a short-lived **access token** and a longer **refresh token** (rotated on every use).

### 2.1 Endpoints (all under `/api/v1`, all JSON)

| Purpose | Call |
|---|---|
| Check number is on the committee, greet, know if a PIN is set | `POST /auth/phone {phone}` → `{onCommittee, firstName?, pinSet}` |
| Everyday sign-in | `POST /auth/login {phone, pin}` → token pair |
| Request a one-time code | `POST /auth/otp/request {phone, purpose}` (`FIRST_LOGIN` or `PIN_RESET`) → 202 |
| Verify the code | `POST /auth/otp/verify {phone, code}` → `{resetToken}` |
| Set a new PIN (first-login / forgot / change) | `POST /auth/pin/set {resetToken, newPin}` → token pair |
| Rotate tokens | `POST /auth/token/refresh {refreshToken}` → token pair |
| Sign out this device | `POST /auth/logout {refreshToken}` → 204 |
| Re-check PIN to unlock the app | `POST /auth/verify-pin {pin}` (bearer) → 204/401 |
| Who am I | `GET /me` (bearer) → `{id, name, role}` |

**Token pair** = `{ accessToken, refreshToken, tokenType: "Bearer", expiresInSeconds }`.

### 2.1a Email OTP migration addendum (current)

> ⚠️ **Removed / superseded — do not implement the pre-email OTP contract above as written.**
> It predates the backend's email-delivery change. The unchanged request and verification
> endpoints still identify the member by phone; only code delivery and the surrounding
> committee data changed.

- `POST /auth/phone` now returns `{onCommittee, firstName?, pinSet, emailHint}`. `emailHint`
  is masked and is `null` when `onCommittee=false`; show it on the OTP screen.
- `POST /committee` requires `email` in addition to name, phone and role.
- `PATCH /committee/{id}` accepts a partial body: `{role?, email?, name?}`. A signed-in admin
  may edit their own name/email, but may not change their own role.
- `GET /committee` and `GET /committee/{id}` return `email`; show it exactly as returned so an
  admin can correct legacy placeholder addresses such as `@invalid.local`.
- OTPs are emailed for first login and PIN resets. They remain six digits, expire after ten
  minutes, and retain the 60-second resend throttle.
- Handle `otp_send_failed` (502) with “Couldn't send the code, please try again” and leave
  Resend enabled. Handle `no_email_on_file` (409) by asking the member to contact the treasurer.

### 2.2 Sign-in flow (screens map to design)

1. **Number screen:** `+91` fixed, 10-digit input. On continue → `POST /auth/phone`.
   - `onCommittee=false` → show "This number isn't on the committee" and stop.
   - `onCommittee=true` → greet by `firstName`. If `pinSet=true` → go to PIN screen; if
     `pinSet=false` → first-login: go to the OTP screen and immediately call
     `POST /auth/otp/request {phone, purpose:"FIRST_LOGIN"}`.
2. **PIN screen:** 4 dots + in-app keypad; auto-submit on the 4th digit → `POST /auth/login`.
   - `401` → clear the field, show "Wrong PIN", offer "Forgot M-PIN?".
   - `423` → "Too many attempts, locked. Try again later or reset your PIN."
   - `409` → PIN not set → route into the first-login OTP flow.
3. **Forgot M-PIN:** `POST /auth/otp/request {phone, purpose:"PIN_RESET"}` → OTP screen.
4. **OTP screen:** 6 dots → `POST /auth/otp/verify` → store `resetToken` in memory → New-PIN screen.
5. **New-PIN screen:** `POST /auth/pin/set {resetToken, newPin}` → store the token pair → into the app.

### 2.3 Requests, refresh, and app-lock

- Attach `Authorization: Bearer <accessToken>` to every non-auth request.
- On **401** from a protected call, try `POST /auth/token/refresh` once. On success, retry the
  original request with the new access token. On failure → clear tokens, return to the number
  screen. Because refresh tokens rotate, always persist the new pair.
- **App-lock:** after N minutes of inactivity (client-side timer; default ~5 min), lock the UI
  and show the PIN keypad. Unlock by calling `POST /auth/verify-pin {pin}` (200 → unlock, 401
  → wrong). The tokens keep living underneath; the PIN is never stored on device.
- **Sign out:** `POST /auth/logout {refreshToken}` then clear stored tokens.
- **Rights are re-derived per screen:** don't cache the role from login forever. Read it from
  `GET /me`, and re-fetch `/me` + the screen's data on focus. If an admin demotes a collector
  mid-session, the next screen already reflects it (the server returns the new role / 403).

---

## 3. Roles & UI gating

Gate visibility of buttons/screens by role, but treat the server as authoritative (it returns
**403** if a role attempts something it shouldn't; **401** if unauthenticated).

| Capability | Admin | Collector | Viewer |
|---|:--:|:--:|:--:|
| Read shops & people (list, detail, profile) | ✅ | ✅ | ✅ |
| Register / edit shops & people; add renter/staff; capture photo/Aadhaar | ✅ | ✅ | — |
| Transfer licence; remove a link; soft-delete a shop/person | ✅ | — | — |
| View a stored Aadhaar image | ✅ | — | — |
| Committee management (add/role/reset-PIN/remove members) | ✅ | — | — |

Design mapping: hide "+ Register new shop", "+ Add a member", Edit, "Record a contribution"
(v2 anyway) for viewers; show Transfer / Delete / Aadhaar-image / Committee only for admins.

---

## 4. API conventions

- **Base path:** `/api/v1`.
- **Auth header:** `Authorization: Bearer <accessToken>`.
- **Error body:** `{ "code": "<machine_code>", "message": "<human message>" }`. Show
  `message`; branch on `code` where useful (table in §10).
- **Pagination:** list endpoints return
  `{ content: [...], page, size, totalElements, totalPages }`. Query params: `query`, plus a
  filter (`lane` for shops, `role` for people), `page` (0-based), `size` (default 20, max 100).
- **Status codes you'll handle:** 200/201/204 success; 400 validation/rule; 401 auth;
  403 forbidden (role); 404 not found; 409 conflict (duplicate); 423 locked; 429 throttled.

---

## 5. Screens ↔ API (v1)

The bottom tab bar in v1 is effectively **Shops · People · Home · Account** (Account opens
from the initials top-right, not a tab). **Events** and **Fund** tabs are v2 — omit them.

### 5.1 Home (landing)

v1 has **no dashboard/metrics endpoint** and no money data. Keep Home light:
- Show shop/people counts by reading `totalElements` from `GET /shops?size=1` and
  `GET /people?size=1`.
- Provide quick entry points to Shops and People (and, for admins, Committee via Account).
- **Do not** render fund balance, event cards, pending collections, or top contributors —
  those are v2.

### 5.2 Shops list — `GET /shops?query=&lane=&page=&size=`

- Single search box → `query` (matches shop number, business name, or any linked person's
  name/phone). Filter chips → `lane` (values are free text; you can derive chips from distinct
  lanes seen, or offer "All" + a lane text filter). Count line from `totalElements`.
- Card fields from `ShopListItemResponse`: `shopNumber`, `businessName`, `lane`,
  `licenceHolderName`, `rentedToName` ("Rented to …" when present), `staffCount`.
  **No fee chip in v1** (fees are v2).
- "+ Register new shop" (admin/collector) → §5.4.
- Paginate (infinite scroll or pages); never fetch the whole list.

### 5.3 Shop detail — `GET /shops/{id}` → `ShopDetailResponse`

- Header: `shopNumber`, `businessName`, `lane`, and — if `formerHolderName` present —
  "Previously: {formerHolderName} · licence held till {formerHolderTill}". **Edit** (admin/collector).
- **People at this shop:** `people[]` = `{ linkId, personId, name, phone, role }`, tap → member
  profile. Order is owner, renter, staff.
- Actions: **+ Add person to this shop** → search-first sheet (§5.7) → `POST /shops/{id}/links`.
  **Transfer licence** (admin) → §5.5. **Delete shop** (admin) → `DELETE /shops/{id}` (confirm:
  it unlinks everyone).
- **Omit** the fee card and "Earlier years" (v2).
- **Edit** → `PATCH /shops/{id} { shopNumber, businessName, lane, tenancy }` (send all four).
  409 on a taken shop number.

### 5.4 Register shop (shop first, then owner)

Two-step flow matching the design:
1. Shop form: `shopNumber`, `businessName`, `lane`, `tenancy` (`OWNER_RUN` | `RENTED_OUT`),
   and the licence holder — **pick an existing member** or **add a new person**.
2. Submit `POST /shops`:
   ```json
   { "shopNumber": "A-31", "businessName": "…", "lane": "Lane 2", "tenancy": "OWNER_RUN",
     "owner": { "existingPersonId": "<uuid>" } }
   ```
   or, for a new owner, `"owner": { "newPerson": { …member fields… } }` (member fields in §5.8).
   For a new owner you'll run the **member form (incl. photo + Aadhaar capture)** as "step 2 of 2"
   and put the resulting S3 keys into `newPerson`.
- 409 → duplicate shop number.

### 5.5 Transfer licence (admin) — `POST /shops/{id}/transfer`

- Search-first: pick an existing member, or "Not on record — create new" → member form.
- Body: `{ "existingPersonId": "<uuid>" }` or `{ "newPerson": {…} }`, plus optional
  `"tillDate": "YYYY-MM-DD"` (defaults today).
- The sheet should state: past contributions stay with the former holder (v2), and the old
  owner is replaced. Response is the updated `ShopDetailResponse`.

### 5.6 People list — `GET /people?query=&role=&page=&size=`

- Search box → `query` (name, phone, or shop number). Filter chips → `role`
  (`OWNER` | `RENTER` | `STAFF`, plus "All" = omit the param).
- Row from `PersonListItemResponse`: `name`, `phone`, and `shops[]`
  (`{ linkId, shopId, shopNumber, businessName, role }`). Show shops+roles.
  **Omit** "lifetime given total" and "last contribution" (v2). The **Collect** action is v2.
  Keep **History** → opens the profile.
- "+ Add a member" (admin/collector) → search-first sheet (§5.7).

### 5.7 Search-first "add" sheet (the duplicate guard)

Both "+ Add person to this shop" and "+ Add a member" open a **search sheet**, never a blank
form:
- As the user types, call `GET /people?query=<text>` and show matches (name, phone, shops).
- Selecting a match links the existing person (no new profile).
  - From a shop: `POST /shops/{id}/links { role, existingPersonId }` — role choices **RENTER /
    STAFF only** (owner is set via registration/transfer).
  - Standalone: proceed to the profile / link flow.
- Only if nothing matches → "Not on record — create new" opens the member form (§5.8).

### 5.8 Member form & profile

**Add member (standalone)** → `POST /people`:
```json
{ "person": { "name": "…", "phone": "9820000000", "whatsappPhone": "9820000000",
              "address": "…", "photoKey": "<key>", "aadhaarFrontKey": "<key>",
              "aadhaarBackKey": "<key?>", "aadhaarLast4": "1234?", "consent": true },
  "links": [ { "shopId": "<uuid>", "role": "STAFF" } ] }
```
- **At least one link is required, and only `RENTER`/`STAFF`** (an `OWNER` link here → 400).
  Owners are only created via shop registration or transfer.
- `photoKey` and `aadhaarFrontKey` come from the upload flow (§6). `whatsappPhone` defaults to
  `phone` if omitted. `consent` must be `true`.
- 409 → duplicate phone.

**Member profile** → `GET /people/{id}` → `PersonProfileResponse`:
`{ id, name, phone, whatsappPhone, address, aadhaarLast4, consent, addedByName, addedOn,
   photoUrl, shops[] }`.
- Header: name, roles/shops, **Edit** (admin/collector).
- **Member photo:** use `photoUrl` (a short-lived signed URL) directly in `<Image>`. **Retake**
  → capture → `PUT /people/{id}/photo { key }`.
- **Shops & roles:** `shops[]` (each `{ linkId, shopId, shopNumber, businessName, role }`), tap
  → shop. "+ Link another shop & role" → `POST /people/{id}/links { shopId, role }` (RENTER/STAFF).
  Unlink a renter/staff → `DELETE /links/{linkId}` (admin).
- **Details:** phone, WhatsApp, address, "Added on {addedOn} · by {addedByName}". Call/WhatsApp
  are device actions (dialer / wa.me).
- **Aadhaar on file:**
  - **Admin:** fetch `GET /people/{id}/aadhaar/FRONT` (and `/BACK`) → `{ url }`, show the image.
    Every view is logged server-side. `PUT /people/{id}/aadhaar { side, key }` to re-capture.
  - **Collector/Viewer:** show a **blurred/locked** placeholder with "Aadhaar is visible to the
    admin only" (do not call the endpoint — it returns 403). Collectors may still **re-capture**
    (`PUT`), but never view.
  - Show `aadhaarLast4` and the capture info (addedBy/on) regardless.
- **Edit** → `PATCH /people/{id} { name, phone, whatsappPhone, address }` (409 on dup phone).
- **Delete** (admin) → `DELETE /people/{id}` (soft; unlinks).
- **Omit** the contribution history and "Record a contribution" (v2).

### 5.9 Account

- Identity: `GET /me` → name, role; show the signed-in number (from login state).
- **Change M-PIN:** runs the OTP → new-PIN flow (`otp/request` `PIN_RESET` → `otp/verify` →
  `pin/set`).
- **Sign out:** `POST /auth/logout`.
- **Your rights:** a plain-language statement per role (static text).
- **Admin only — Committee members & roles:** §5.10.
- **Omit** Cash-with-you / Cash handovers / Cancelled receipts / Annual fee cycle / Reports /
  Association settings backend bits (all v2). You may keep a static "Association" identity block.

### 5.10 Committee management (admin) — `/api/v1/committee`

- List → `GET /committee` → `[{ id, name, phone, role, active, pinSet, removedAt }]`. Show
  active first; grey out rows where `active=false` with "Removed {removedAt}".
- Add → `POST /committee { name, phone, role }` (201). The new member sets their own PIN via
  first-login; tell the admin "they'll set a PIN on first sign-in." 409 on duplicate number.
- Change role → `PATCH /committee/{id} { role }`.
- Reset PIN → `POST /committee/{id}/reset-pin` (they're signed out and must set a new PIN).
- Remove → `DELETE /committee/{id}` (soft; they can't sign in; the number frees up).
- Guards surfaced as 400: you can't change/remove **yourself**, and you can't remove/demote the
  **last admin** — show the returned `message`.

---

## 6. Image capture & upload (photos + Aadhaar)

The API never receives image bytes. For each image:
1. `POST /media/upload-url { type }` where `type` ∈ `PHOTO` | `AADHAAR_FRONT` | `AADHAAR_BACK`
   → `{ key, uploadUrl, expiresInSeconds }`.
2. `PUT` the file bytes to `uploadUrl` directly (no auth header — the URL is pre-signed). In RN,
   read the captured file and `fetch(uploadUrl, { method: 'PUT', body: <blob/bytes>, headers: { 'Content-Type': 'image/jpeg' } })`.
3. Keep the returned `key`. Submit it in the person payload (`photoKey` / `aadhaarFrontKey` /
   `aadhaarBackKey`) or in a retake/re-capture `PUT`.
- **Order matters:** capture + upload all images while filling the form, then submit the final
  create with the keys. The upload URL expires (~5 min), so don't fetch it too early.
- **Viewing:** `GET /people/{id}/photo` (any role) and `GET /people/{id}/aadhaar/{side}` (admin)
  return short-lived signed `url`s to load into `<Image>`.

---

## 7. Data models (response shapes the FE consumes)

```
TokenPair          { accessToken, refreshToken, tokenType, expiresInSeconds }
Me                 { id, name, role }                     // role: ADMIN|COLLECTOR|VIEWER
Paged<T>           { content: T[], page, size, totalElements, totalPages }

ShopListItem       { id, shopNumber, businessName, lane, tenancy, licenceHolderName,
                     rentedToName, staffCount }
ShopDetail         { id, shopNumber, businessName, lane, tenancy, formerHolderName,
                     formerHolderTill, people: PersonAtShop[] }
PersonAtShop       { linkId, personId, name, phone, role }   // role: OWNER|RENTER|STAFF

PersonListItem     { id, name, phone, shops: PersonShopLink[] }
PersonProfile      { id, name, phone, whatsappPhone, address, aadhaarLast4, consent,
                     addedByName, addedOn, photoUrl, shops: PersonShopLink[] }
PersonShopLink     { linkId, shopId, shopNumber, businessName, role }

CommitteeMember    { id, name, phone, role, active, pinSet, removedAt }

UploadUrl          { key, uploadUrl, expiresInSeconds }
SignedUrl          { url, expiresInSeconds }
ApiError           { code, message }
```

`tenancy`: `OWNER_RUN` | `RENTED_OUT`. `role` (link): `OWNER` | `RENTER` | `STAFF`.
`role` (committee): `ADMIN` | `COLLECTOR` | `VIEWER`.

---

## 8. Client-side validation (mirror the server)

Validate before submitting to give instant feedback; the server enforces the same and returns
`400`/`409` if bypassed.

- **Phone / WhatsApp:** exactly 10 digits (India, `+91` fixed in UI). Hard-unique — a duplicate
  returns 409 (`duplicate_phone`). You may pre-warn using `GET /people?query=<phone>`.
- **M-PIN:** exactly 4 digits. **OTP:** 6 digits.
- **Shop number:** required; unique across the market, case-insensitive (409
  `duplicate_shop_number`). Trim before sending.
- **Business name, name:** required (non-blank).
- **Consent:** must be ticked (`consent=true`) — mandatory to save a member.
- **Photo + Aadhaar front:** mandatory for a new member (upload first, then submit the key).
  Aadhaar back + last-4 are optional.
- **Link role from a shop / standalone add:** `RENTER` or `STAFF` only (never `OWNER`).

---

## 9. Business rules the UI must respect

- **A shop always has exactly one owner.** Never offer "remove owner". Owner changes only
  through **Transfer licence**. Registration/transfer are the only ways to create an owner.
- **≤1 owner, ≤1 renter, many staff per shop.** Adding a second renter → 409 (`renter_exists`).
  A person can hold at most one role per shop (409 `already_linked`).
- **No shopless members at creation** — every add-member requires ≥1 shop link. A member can
  become "No shop linked" later if their last renter/staff link is removed; render that state.
- **Soft-delete** hides shops/people (recoverable) and **frees the number/phone** for a new
  record — so a "duplicate" error can legitimately be resolved by an admin restoring/deleting.
  Prefer **Edit** for fixing a typo; use delete only when a record shouldn't exist.
- **Aadhaar is the strictest data:** collectors capture but can never view it again; only admins
  view, and every view is logged. Don't even call the Aadhaar GET as a non-admin.
- **Removed committee member:** cannot sign in; `POST /auth/phone` returns `onCommittee=false`
  for them, and their number can be re-added.

---

## 10. Error handling (map `code` → UX)

| HTTP | `code` | UX |
|---|---|---|
| 401 | `unauthorized` / `invalid_token` | Try refresh once; else return to sign-in |
| 403 | `forbidden` | "You don't have permission for this" (shouldn't happen if UI is gated) |
| 423 | `pin_locked` | "Locked after too many attempts — try later or reset PIN" |
| 409 | `duplicate_phone` | "A member with this phone already exists" |
| 409 | `duplicate_shop_number` | "A shop with this number already exists" |
| 409 | `renter_exists` / `already_linked` | "This shop already has a renter" / "Already linked here" |
| 400 | `owner_not_addable` / `owner_not_removable` | "The licence holder is set via registration/transfer" |
| 400 | `self_action` / `last_admin` | Show the message (committee guards) |
| 400 | `validation_error` | Field-level message from `message` |
| 401 | `wrong_pin` | "Wrong PIN" (clear field, offer reset) |
| 409 | `pin_not_set` | Route into first-login OTP |
| 429 | `otp_throttled` | "Please wait before requesting another code" |
| 404 | `*_not_found` | "Not found" / navigate back |

Always assume patchy network: never let a save appear to succeed when it didn't (there is no
offline mode). Show a clear error and a retry.

---

## 11. Formatting & device actions

- Phone shown as `+91 XXXXXXXXXX`; store/send the 10 digits.
- Dates: `formerHolderTill`, `addedOn` come as ISO (`YYYY-MM-DD` / ISO instant) — format for
  display (DD MMM YYYY). Times are UTC; present in IST.
- Initials avatars: derive from `name`.
- **Call** → open the dialer with the number. **WhatsApp** → open `wa.me/<91+number>`.
- (₹ Indian grouping / amounts-in-words are v2 concerns — no money in v1.)

---

## 12. Suggested build order

1. **Auth**: number → PIN → first-login OTP → set-PIN; token storage; bearer + refresh
   interceptor; app-lock; `GET /me`; role context.
2. **Shops**: list/search/paginate → detail → register (with owner) → edit → add link →
   transfer → delete.
3. **People/media**: upload flow first; then add (standalone) → list/search → profile (photo +
   Aadhaar gating) → edit → link → delete.
4. **Account + Committee** (admin): identity, change-PIN, sign-out; committee list/add/role/
   reset/remove.
5. **Home**: light landing with counts + shortcuts.

Wire each screen against the real endpoints above. If something you expect (e.g. a fee chip, a
dashboard total, a receipt) isn't in this doc, it's **v2 — leave it out** rather than inventing
an endpoint.
