# Phase 7 — Account & Committee

**Goal:** let a member change their own M-PIN, and let an admin manage who can sign in — with
the two guards the spec insists on.

The last feature phase. With it, every screen in integration doc §5 exists.

---

## 1. What was decided

| Topic | Decision |
|---|---|
| Change M-PIN | **One screen with three internal steps**, not a reuse of the sign-in stack — that stack isn't mounted while signed in. |
| Which flow | The same `otp/request PIN_RESET → otp/verify → pin/set`, because that *is* the flow. There is no change-PIN endpoint. |
| Confirmation | Inside `MemberActionsSheet` as a second state, **not** a nested `ConfirmSheet`. |
| Your own row | Shows a "You" chip and is not tappable. |
| Onboarding | The admin never sets a PIN. New members are created `pinSet: false` and use first-login. |
| v2 rows | Cash with you, Cash handovers, Cancelled receipts, Annual fee cycle, Reports, Association settings — all absent. |

---

## 2. Files

```
features/account/ChangePinScreen.tsx
features/account/AccountScreen.tsx        + Change M-PIN, + Committee (admin)
features/committee/
├── hooks.ts                    list + 4 mutations
├── CommitteeScreen.tsx         the roster
├── AddCommitteeMemberScreen.tsx
└── MemberActionsSheet.tsx      role · reset PIN · remove
```

---

## 3. Change M-PIN — `ChangePinScreen`

```
intro   explain, "Send code"  → POST /auth/otp/request { PIN_RESET }
otp     6 dots + keypad       → POST /auth/otp/verify → resetToken
newPin  4 dots + keypad       → completePinSetup(phone, resetToken, pin)
done    success banner + Done
```

Reuses `CodeDots` and `Keypad` with a 60s resend cooldown. It duplicates a little of
`OtpScreen` / `NewPinScreen`, which was the deliberate trade: those are separate stack screens
typed to `AuthStackParamList`, and making them dual-stack was more contortion than one
self-contained screen.

### Checked before building: does this sign you out?

`AuthService.setPin` sets the hash, sets `pinSet=true`, clears the lockout, and issues a new
token pair. It does **not** bump `token_version` and does **not** revoke refresh tokens. So the
current session survives a PIN change.

It still returns a fresh pair, and `completePinSetup` adopts it — the existing `AuthContext`
method is exactly right here, so no new API was needed. (Compare `reset-pin`, the *admin*
action, which does bump `token_version` and revoke — see §5.)

---

## 4. Committee roster — `CommitteeScreen`

`GET /committee` returns active members first, then removed ones with `removedAt`. Removed rows
stay visible, greyed at 55% opacity, with the date — that history is the point of a soft remove.

Row: avatar, name, phone, role chip, and either "Removed {date}" or "M-PIN not set yet".

Tappable only when `member.active && member.id !== me.id`:

- **You cannot act on yourself** — another admin must (spec §6.13). Your row shows a "You" chip
  and a line pointing at Account for changing your own PIN.
- Removed members have nothing left to change.

The screen shows a notice when there is exactly **one** active admin, since that is the state
where an admin change is about to be refused.

No collection figures here, per spec §6.13 — that information belongs on each entry and receipt.

### `MemberActionsSheet`

Role chips `PATCH` immediately on tap, with a line stating that a role change applies on their
next screen without signing out (true — the API re-derives the role from the database per
request). Then "Reset their M-PIN" and "Remove from committee", each switching the sheet into a
confirm state.

**Confirmation is a second state of the same sheet, not a nested one.** Nesting RN `Modal`s is
unreliable, and a two-state sheet reads better anyway.

The confirm copy states what actually happens: reset clears their PIN and signs them out
everywhere, and the admin never sees or types the new one; remove signs them out immediately,
keeps the row as history, and frees the number.

### `AddCommitteeMemberScreen`

Name, number, role — with a paragraph per role from integration doc §3's capability table, so
the admin knows what they're granting. Default `COLLECTOR`.

A prominent notice: *"You don't set their M-PIN. They'll be sent a one-time code and choose
their own the first time they sign in."* That is the entire onboarding path (api slice 5,
"Option B") — there is no invite to send, and no OTP is pushed on add.

`409 duplicate_phone` becomes an inline field error. Uniqueness is among **active** rows, so a
freed number is legitimately re-addable.

---

## 5. Verification

14 assertions against a live API:

```
list                            active members ordered before removed ones
add                             pinSet false — they set their own on first sign-in
duplicate active phone →        409 duplicate_phone
change your own role →          400 self_action
remove yourself →               400 self_action
collector → admin → collector   applied (another admin remained)
reset PIN                       pinSet cleared
remove                          active false + removedAt stamped
removed member                  POST /auth/phone → onCommittee false
re-add the same number          new row; the number was freed
```

Session-invalidation behaviour is verified in [08 §5](08-verification.md#5-role-gating): an
admin's `reset-pin` kills the member's live access token (`401 unauthorized`), the client's
refresh is rejected, and `onSessionExpired` clears the stored session.

---

## 6. Note: `last_admin` is unreachable through the API

The guard exists and is correct, but it cannot fire:

- The endpoint is admin-only, so the actor is always an admin.
- To trigger `last_admin` you would have to demote or remove an admin such that none remain.
- If the target were the last admin, it would **be** the actor — and `self_action` fires first.
- With two admins, removing one always leaves one.

api slice 5 half-acknowledges this ("the self-guard fires first… it becomes the distinguishing
check only when ≥2 admins exist"), but even then it can't fire. Keep it as a backstop; don't
chase test coverage for it.

---

## 7. Still open in Account

Not built, and not v1:

- The design's static "Association" identity block (WhatsApp sender, receipt series, annual fee,
  last backup) — the settings behind it are v2.
- Everything money-shaped: Cash with you, Cash handovers, Cancelled receipts, Annual fee cycle,
  Reports.

Built: identity from `/me`, the per-role rights statement (integration doc §3), Change M-PIN,
Committee (admin), Lock app, Sign out, and a `__DEV__` link to the media harness.
