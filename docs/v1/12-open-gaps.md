# Open gaps

Things known to be missing or imperfect, with enough detail to act on. Kept separate from the
phase docs so it can be worked through as a list.

---

## 1. Aadhaar capture attribution is not shown, and cannot be (**needs an API change**)

**The audit trail exists and works.** Every Aadhaar view and re-capture writes a row to
`aadhaar_access_log` with the acting user, the side and a timestamp — confirmed live:

```
 action    | side  | actor           | accessed_at
-----------+-------+-----------------+-------------------------------
 RECAPTURE | FRONT | Colin Collector | 2026-08-22 20:09:42.580608+00
 VIEW      | FRONT | Ishwar          | 2026-08-22 20:07:07.572632+00
```

**But no endpoint exposes it.** `AadhaarAccessLog` appears only in `PersonMediaService` (which
writes it), its repository and its entity — there is no controller. From the client's point of
view the log is write-only.

**And `PersonProfileResponse` carries no capture attribution.** Its `addedByName` / `addedOn`
come from `person.getCreatedBy()` / `getCreatedAt()`; api slice 4 chose this deliberately
("Profile shows Aadhaar 'captured by / when' from the member's added-by / added-on — no
separate capturer field").

### Why that's a problem

Functional spec §4.3 says the locked image area should show "only **who captured it and when**".
The panel was rendering:

```
Captured by {addedByName} · {addedOn}
```

After a collector re-captures, those values still name whoever *created the member*. In the log
above, the front image is Colin's work from 20:09 — but the panel would have said "Captured by
Ishwar". **It attributed the image to the wrong person**, which is worse than showing nothing,
because the whole point of the Aadhaar rules is knowing who touched what.

### Fixed on the client, partially

The label now reads **"Member added by X · date"** — truthful about what the field is. Capture
attribution is simply absent rather than wrong.

### To do it properly, the API needs one of

1. **Denormalised fields on `PersonProfileResponse`** — cheapest and enough for the UI:
   `aadhaarFrontCapturedByName`, `aadhaarFrontCapturedAt`, and the same for `BACK`. Derived from
   the latest `RECAPTURE` row, falling back to the member's creation for the original capture.
2. **A read endpoint**, admin-only: `GET /people/{id}/aadhaar/history` →
   `[{ action, side, actorName, at }]`. More faithful to the spec's audit intent, and it would
   let an admin see the *view* history too — which is arguably the more valuable half, since
   that's the record of who looked at someone's Aadhaar.

Option 1 unblocks the label. Option 2 is the one worth having if the committee ever needs to
answer "who looked at this?".

**Note the display rule stays the same either way:** the *attribution* is metadata, not the
image, so it is safe to show every role. Only the image itself is admin-only.

---

## 2. Not yet verified

- **No automated tests exist.** All verification so far was throwaway harnesses against a live
  API — see [08 §7](08-verification.md#7-what-is-not-covered) for the prioritised list.
- **Viewer role never exercised on a device.** Collector has been (and looked correct);
  `Vishal Again` (9700000001) is an active VIEWER with `pinSet: false`, ready for first-login.
- **iOS never run at all.** Every device session has been Android. The known iOS-specific
  divergences are the Aadhaar crop (§ [11 §6](11-development-build.md)) and
  `KeyboardAvoidingView` behaviour.

---

## 3. Deliberate omissions, decided not forgotten

| Item | Why |
|---|---|
| **Floor** field on shops | No `floor` column in the v1 API; decision was to leave the API as-is |
| **Wing/lane as chips** | `lane` is free text with no master list |
| Fee chips, GIVEN TOTAL, Collect, receipts, events, fund | v2 — no API |
| Free-form Aadhaar crop | Not possible in `expo-image-picker`; needs a dev build ([11 §6](11-development-build.md)) |
| `GET /committee/{id}` | Wrapped but unused — the list already carries every field |
| `GET /people/{id}/photo` | Wrapped but unused — the profile serves `photoUrl` inline |

---

## 4. Housekeeping

- **Removed:** the `__DEV__` media harness (`src/features/dev/`) and its registrations, now that
  the member form has been exercised on a device.
- **Dead committee rows.** Removed members persist as `active: false` by design, so the roster
  carries several test accounts (`Test Collector` ×2, `Test Viewer`, `Vishal President`,
  `Anita Admin`). Harmless, but noisy on a five-person committee — purge from the dev database
  if it gets in the way.
- **Seed data was mutated during testing.** Ramesh Patil's photo and Aadhaar front are the
  association logo.
- **`.idea/dpb-association-fe.iml`** is untracked IntelliJ noise; belongs in `.gitignore`.

---

## 5. API-side items raised from the client

Neither blocks anything; both are written up in full in [09](09-api-defects.md) and
[10 §8.5](10-design-review-fixes.md).

1. **`HV000271`** — `@Valid` on the `links` container instead of its element in
   `CreatePersonRequest`. Cascading still works today (verified), so it is not yet a bug, but
   the deprecated path may stop cascading in a future Hibernate Validator.
2. **`GlobalExceptionHandler` logs nothing and has no catch-all.** A genuine 500 currently
   returns Boot's default body — no `code` field, and a stack trace on the wire. Adding a
   catch-all `Exception` handler plus INFO-level logging for 4xx would fix both the log noise
   and the client's inability to branch on a server error.
