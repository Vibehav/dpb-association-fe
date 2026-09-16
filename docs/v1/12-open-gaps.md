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

- **Component/layout coverage is thin, though no longer absent.** 139 tests across 14 suites.
  Four render something: `IdProofPanel`, `IdProofReplaceScreen`, `MemberForm` and `Field`. The
  shop and list screens still render nowhere. See [13 § Still unguarded](13-bug-log.md).
- **Nothing in the ID-proof refactor has run against a live API.** Every test mocks `peopleApi`,
  so the new payload shape, the renamed endpoints, the `id-proofs/` keys and the two `PUT`s are
  verified only against a reading of the backend source. The API work is also still on the
  unmerged `feature/IdProof_Refactor`. This is the largest unverified surface in v1.
- **Viewer role never exercised on a device.** Collector has been (and looked correct);
  `Vishal Again` (9700000001) is an active VIEWER with `pinSet: false`, ready for first-login.
- **iOS never run at all, and now less certain.** Every session has been Android, and the app
  now depends on `react-native-image-crop-picker`, whose iOS path is untested here. That library
  is on the critical path for **every** ID-proof capture across all five document types, so this
  is unproven ground rather than a polish item if iOS is in scope.

---

## 3. Deliberate omissions, decided not forgotten

| Item | Why |
|---|---|
| **Floor** field on shops | No `floor` column in the v1 API; decision was to leave the API as-is |
| **Wing/lane as chips** | `lane` is free text with no master list |
| Fee chips, GIVEN TOTAL, Collect, receipts, events, fund | v2 — no API |
| ~~Free-form Aadhaar crop~~ | **Done** — `react-native-image-crop-picker` behind `src/media/cropPicker.ts` |
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

## 4a. ID-proof access log — endpoint exists, screen not built (**deferred, 2026-09-17**)

`fe-handoff-id-proof-followups.md` §2 shipped `GET /people/{id}/id-proof/log`, admin-only. It
answers the question §1 of this document says the client *cannot* answer — who viewed or
re-captured a member's ID proof, and when. **Nothing consumes it yet.**

```jsonc
[{ "action": "RECAPTURE", "side": null, "idProofType": "PAN",
   "previousIdProofType": "PASSPORT", "actorName": "Ishwar",
   "accessedAt": "2026-09-16T17:12:04.918Z" }]
```

To build it: a `peopleApi.idProofLog` method, the row type, a `useIdProofLog` hook, a list
screen behind a "View access history" action on `IdProofPanel`, and a route. Self-contained —
it touches nothing that already works.

Three details from the hand-off worth not rediscovering:

- `side: null` means *the whole document was replaced*, not an unknown side. Don't render
  "replaced the null side".
- `previousIdProofType` is non-null **only when a replace actually changed the type**, and it
  is the one place a document swap is visible. Use it as the signal for a "Passport → PAN"
  second line.
- Reading the log does **not** itself write a log entry, so opening the screen is free. There
  is no pagination; a single member's log is small.

**Note this only partly closes §1 above.** The log names who *touched* the image, so "last
re-captured by X" becomes answerable. It still does not give the profile a per-side
"captured by / when" pair, which is what §1 asks for — that remains an API-side gap.

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
