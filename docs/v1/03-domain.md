# Phase 3 — Domain layer

**Goal:** wire types that mirror the API exactly, one module per resource, and the validation
and formatting rules from integration doc §8 and §11.

**Delivered with phase 1** — it is mechanical once the client exists, and every later phase
needs it.

---

## 1. What was decided

| Topic | Decision |
|---|---|
| Shape of types | **1:1 with the API's DTOs.** No view models, no renaming, no derived fields. Screens consume wire types directly. |
| Nullability | Typed `\| null` wherever Jackson can serialise null, even where an invariant says it won't. Defensive typing at the boundary costs nothing. |
| Verification | Every response type was checked against the actual controller signatures, not inferred from the docs. |
| Validation | Hand-written `validators.ts` keyed to §8, returning a message or `null` so callers can show one thing at a time. |
| Money helpers | **Deleted.** v1 has no money (§11). The old `money()` existed only to render mock figures. |

---

## 2. Wire types — `src/api/types.ts`

Enums: `Role` (`ADMIN|COLLECTOR|VIEWER`), `Tenancy` (`OWNER_RUN|RENTED_OUT`), `LinkRole`
(`OWNER|RENTER|STAFF`), `LinkableRole` (`RENTER|STAFF` — plus `LINKABLE_ROLES` for iteration),
`MediaType` (`PHOTO|AADHAAR_FRONT|AADHAAR_BACK`), `AadhaarSide`, `OtpPurpose`.

Responses: `Paged<T>`, `PhoneCheckResponse`, `ResetTokenResponse`, `Me`, `ShopListItem`,
`ShopDetail`, `PersonAtShop`, `PersonListItem`, `PersonProfile`, `PersonShopLink`,
`CommitteeMember`, `UploadUrlResponse`, `SignedUrlResponse`.

Requests: `RegisterShopRequest`, `UpdateShopRequest`, `AddShopLinkRequest`, `TransferRequest`,
`OwnerInput`, `NewPersonPayload`, `CreatePersonRequest`, `UpdatePersonRequest`,
`AddPersonLinkRequest`, `AddCommitteeMemberRequest`, plus `ShopListParams` / `PeopleListParams`.

### `OwnerInput` is a discriminated union

```ts
export type OwnerInput =
  | { existingPersonId: string; newPerson?: never }
  | { newPerson: NewPersonPayload; existingPersonId?: never };
```

The `never` guards make "exactly one of these" a compile error rather than a 400. Note the
consequence: **spreading breaks inference.** `{ role, ...body }` where `body` is the union will
not narrow. Build the literal at the call site instead — `link({ role, existingPersonId: id })`
— rather than casting.

### Three things the old client had wrong

| Field | Old behaviour | Reality |
|---|---|---|
| `MediaType` | Sent `MEMBER_PHOTO` and `BILL_PHOTO` | The API enum is `PHOTO \| AADHAAR_FRONT \| AADHAAR_BACK`. `MEMBER_PHOTO` would have 400'd on first real use; `BILL_PHOTO` is a v2 concept with no endpoint. |
| `floor` | Derived from `tenancy === "OPEN_STALL"` | `tenancy` is only `OWNER_RUN\|RENTED_OUT`, and **v1 has no `floor` column at all** (api slice 1: "No wings, no floors"). Every shop rendered "Market". Removed. |
| `feeStatus` / `feeDue` | On the `Shop` type, driving a fee chip | v2. Integration doc §5.2 is explicit: "No fee chip in v1". Removed. |

`tenancy` itself was being dropped by the old mapper; it is now surfaced.

Also confirmed from api slice 1: the functional spec's fourth link role, **"Worker", was dropped**
as identical to `STAFF`. Do not reintroduce it.

---

## 3. API modules — `src/api/`

| Module | Endpoints |
|---|---|
| `authApi` | `/auth/phone` `login` `otp/request` `otp/verify` `pin/set` `token/refresh` `logout` `verify-pin` |
| `meApi` | `GET /me` |
| `shopsApi` | list · detail · register · update · remove · addLink · transfer |
| `linksApi` | `DELETE /links/{linkId}` |
| `peopleApi` | list · detail · create · update · addLink · remove · photoUrl · updatePhoto · aadhaarUrl · updateAadhaar |
| `mediaApi` | `POST /media/upload-url` |
| `committeeApi` | list · detail · add · changeRole · resetPin · remove |

`SHOPS_PAGE_SIZE` and `PEOPLE_PAGE_SIZE` are both **20**, matching the server default. The
server caps `size` at 100.

Every write endpoint's return type was verified by reading the controllers, not the docs:

- every shop mutation returns `ShopDetailResponse`
- every person mutation returns `PersonProfileResponse`
- media `PUT`s return 204
- `POST /shops` and `POST /people` are 201; `POST /shops/{id}/links` is 200

`authApi` deliberately does **not** fetch `/me` and fold the role into a session object, the way
the old `authApi.login()` did. It returns raw token pairs; the role is a separate concern.

`peopleApi.aadhaarUrl` carries the loudest comment in the codebase: admin only, every call is
logged server-side, and non-admins must not call it at all.

---

## 4. Validators — `src/utils/validators.ts`

One function per rule in integration doc §8, each returning a message or `null`.

```
validateName · validatePhone · validateWhatsApp · validatePin · validateOtp
validateShopNumber · validateBusinessName · validateLane
validateAadhaarLast4 · validateConsent · validatePhotoKey · validateAadhaarFrontKey
validateLinks · firstError(...checks)
```

`OTP_LENGTH = 6`, `PIN_LENGTH = 4`.

`firstError` returns the first non-null message, which is how the forms honour spec §7.2's
"one plain message at a time, in this order".

`validateLinks` enforces both halves of the rule: at least one link, and **no `OWNER`** — an
owner exists only through shop registration or a licence transfer.

These give instant feedback; they enforce nothing. The server applies the same rules and answers
400/409 if bypassed.

---

## 5. Formatting and device actions

`src/utils/format.ts`
- `initials` · `titleCase` · `roleLabel`
- `formatDate` → "22 Aug 2026", `formatDateTime` → "22 Aug 2026, 3:04 pm". Both via
  `Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"` — the API sends UTC, §11 wants IST.
- `countLine(shown, total, noun)` → "6 of 1,024 shops shown"
- **No money formatter.**

`src/utils/phone.ts`
- `digitsOnly` · `normalisePhone` (handles a pasted `+91`, `0091` or leading `0`) ·
  `isValidPhone` · `formatPhone` → "+91 9820000000" · `dialerUrl` · `whatsAppUrl`

`src/utils/deviceActions.ts` — `callNumber` and `openWhatsApp`. Both check `canOpenURL` and fail
with an alert rather than an unhandled rejection, since they leave the app (spec §13.3).

---

## 6. Notes

1. **`Intl` is assumed available.** Expo SDK 54's Hermes includes it; the pre-refactor code
   already relied on `Intl.NumberFormat`. If that ever changes, `formatDate`/`formatDateTime`
   and the `toLocaleString("en-IN")` count lines are the call sites.
2. **`aadhaarLast4` is optional but must be exactly 4 digits when given** — a partially typed
   value is a validation error, not a silent truncation.
3. **`whatsappPhone` is omitted rather than sent empty** on create, so the API applies its
   default of "same as phone". On *edit* it is sent explicitly even when identical, so clearing
   a separate number actually takes effect.
