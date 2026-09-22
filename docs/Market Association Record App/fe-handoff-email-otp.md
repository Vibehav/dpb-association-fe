# FE hand-off — OTP now arrives by EMAIL, not SMS

**Backend change, shipped.** Four API changes plus copy. Nothing else in the auth flow moved.

**Why:** SMS to Indian numbers needs TRAI/DLT registration (weeks of paperwork), and OTP
only fires on **first login** and **PIN reset** — never on ordinary login. So codes now go
by email. Every committee member has one. "Forgot M-PIN" stays self-service.

---

## 1. `POST /api/v1/committee` — new **required** field: `email`

```json
{
  "name": "Meera Kadam",
  "phone": "9333300001",
  "email": "meera@example.com",
  "role": "COLLECTOR"
}
```

| Status | Code | When |
|---|---|---|
| 400 | `validation_error` | email missing or malformed |
| 409 | `duplicate_email` | already used by another **active** member (case-insensitive) |
| 409 | `duplicate_phone` | unchanged |

The Add-committee-member form needs an email input, marked required.

---

## 2. `PATCH /api/v1/committee/{id}` — now a partial update

| | |
|---|---|
| **Was** | `{ "role": "ADMIN" }` |
| **Now** | `{ "role"?: Role, "email"?: string, "name"?: string }` — all optional |

A **role-only body behaves exactly as before**, so nothing you already built breaks.

> ### ⚠️ You must add an "edit email" affordance
> Email is the **only** route to a first-login or reset code. A typo locks that member out
> permanently, with no recovery path inside the app. Put it on the committee member sheet.

| Status | Code | When |
|---|---|---|
| 400 | `nothing_to_update` | empty body |
| 400 | `validation_error` | malformed email |
| 409 | `duplicate_email` | address belongs to another active member |
| 400 | `self_action` | see the nuance below |
| 400 | `last_admin` | unchanged |

### UI nuance — the self-guard is now per-field

| Action on the signed-in admin's **own** row | Result |
|---|---|
| Edit own **email** or **name** | ✅ allowed (200) |
| Change own **role** | ❌ blocked (400 `self_action`) |

So on their own row: **enable** email/name editing, **disable** the role picker. Self email
editing is deliberate — a sole admin with a wrong address could otherwise never receive a
reset code.

---

## 3. `GET /api/v1/committee` and `GET /api/v1/committee/{id}` — response gains `email`

```json
{
  "id": "…", "name": "…", "phone": "…",
  "email": "meera@example.com",
  "role": "COLLECTOR", "active": true, "pinSet": false, "removedAt": null
}
```

Show it on the committee screen — the admin needs to see and verify it.

**Note:** some existing test accounts carry placeholder addresses ending in
`@invalid.local`. Those cannot receive codes. Display them as-is; the admin is expected to
correct them via `PATCH`.

---

## 4. `POST /api/v1/auth/phone` — response gains `emailHint`

```json
{
  "onCommittee": true,
  "firstName": "Ishwar",
  "pinSet": true,
  "emailHint": "s************8@g***l.com"
}
```

`null` when `onCommittee=false`. **Masked on purpose** — this endpoint is public. Use it on
the OTP screen so the member knows which inbox to open.

---

## Unchanged — no work needed

| Endpoint | |
|---|---|
| `POST /auth/otp/request` `{phone, purpose}` | → 202. Same shape; the user is still identified by **phone**, only delivery changed. |
| `POST /auth/otp/verify` `{phone, code}` | → `{resetToken}` |
| `POST /auth/pin/set` `{resetToken, newPin}` | → token pair |

Codes are still **6 digits**, valid **10 minutes**, with a **60-second resend throttle**.

---

## New error codes to handle

| Status | Code | What to do |
|---|---|---|
| 502 | `otp_send_failed` | The email provider is down. Show "Couldn't send the code, please try again" and **keep Resend enabled** — the server rolled the code back, so an immediate retry works and the 60s throttle is **not** triggered by a failed send. |
| 409 | `no_email_on_file` | No address on record. Tell the user to contact the treasurer. |
| 409 | `duplicate_email` | See §1 / §2. |
| 400 | `nothing_to_update` | Empty PATCH body. |

---

## Copy changes

- Every "we've sent an SMS" / "code sent to your phone" string becomes
  **"we've emailed a code to `<emailHint>`"**.
- Add a **"check your spam folder"** hint on the OTP entry screen — first-time
  deliverability is the most likely failure mode.
