# V1 — React Native client, phase by phase

> ### ▶ New here? Start with **[14-handoff.md](14-handoff.md)**.
> It is the authority on the current state, what to do next, and what looks broken but isn't.
> The numbered documents below are per-phase records — accurate about *why*, not always about
> *now*.

The build record for the v1 frontend. One document per phase, in the same shape as the API
repo's `docs/v1/` slices: what was decided, what was built, how it was proved, and what bit us.

**Read `../frontend-integration.md` first.** It is the API contract and the v1/v2 scope line,
and it wins over anything here. `../v1-implementation-plan.md` holds the cross-cutting
decisions (§0), the resolved open questions (§12) and the invariants (§13) — this folder is
the per-phase detail.

## Documents

| # | Phase | Covers |
|---|---|---|
| [01](01-foundation.md) | Foundation | Typed errors, the HTTP client, query cache, navigation, UI kit, theme and fonts. The v2 teardown. |
| [02](02-auth.md) | Auth | `AuthContext`, the four sign-in screens, app-lock, and the §10 error routing. |
| [03](03-domain.md) | Domain layer | Wire types, the seven API modules, validators, permissions, formatting. |
| [04](04-media.md) | Media | Compress → presign → PUT → key. The capture slot state machine. |
| [05](05-shops.md) | Shops | List, detail, register (both owner branches), edit, links, transfer, delete. The duplicate guard. |
| [06](06-people.md) | People | List, profile, the Aadhaar panel, edit, standalone add. |
| [07](07-account-committee.md) | Account & Committee | Change M-PIN, committee management and its guards. |
| [08](08-verification.md) | Verification | How everything was proved, every result, and what is **not** covered. |
| [09](09-api-defects.md) | API defects | Three findings in `dpb-association-api`, all resolved. |
| [10](10-design-review-fixes.md) | Design review fixes | Prototype-vs-build pass: the Home reload loop, register-shop fields, the inline pickers, and two fields deliberately not built. |
| [11](11-development-build.md) | Development & production builds | Leaving Expo Go: what must be fixed first, EAS vs local, and free-form Aadhaar cropping. |
| [12](12-open-gaps.md) | Open gaps | Known omissions and unverified areas, incl. the missing Aadhaar capture attribution. |
| [15](15-email-otp.md) | Email OTP migration | Current email-delivery API addendum, UI requirements, and retired SMS/dev-console guidance. |
| [14](14-handoff.md) | **Handoff** | **Read first.** Current state, next steps, non-negotiable rules, and false alarms. |
| [13](13-bug-log.md) | **Bug log** | Every bug found, its cause, its fix, and whether a test guards it. **Append here as new ones turn up.** |

## Status

v1 is **feature-complete** and runs as a native Android development build on a real phone.
97 tests across 10 suites. What remains: a **viewer** device pass, component/layout tests, and
anything release-related. See [14-handoff.md](14-handoff.md) §1 and §4.

Branch `feat/v1-foundation`.

## Delivery order vs. plan order

Two phases were pulled forward, both because a later phase couldn't be built correctly without
them. The documents are numbered by subject, not by the day the code landed:

- **Phase 2 (auth screens) landed with phase 1.** Splitting the monolithic `LoginScreen` into
  four screens was forced by introducing React Navigation — porting the five-steps-in-one-state
  component onto the new stack only to replace it would have been wasted work.
- **Phase 3 (domain layer) landed with phase 1, and `MemberForm` landed with phase 5.** Shop
  registration's "brand-new licence holder" branch needs the member form, so building it in
  phase 5 was cheaper than stubbing registration and returning to it.

## Conventions used throughout

- **Wire types are not reshaped for the UI.** `src/api/types.ts` mirrors the API's DTOs 1:1;
  screens consume them directly. The pre-refactor client mapped responses into invented view
  models and lost real fields while inventing absent ones.
- **The role comes from `GET /me`, never from a stored login response.** Re-derived on every
  screen focus.
- **Failures render as failures.** No mock data, no cached fallback, no silent truncation.
- **The client hides controls; the API refuses requests.** Gating is convenience only.
