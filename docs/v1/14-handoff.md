# Handoff — read this first

Current as of the end of the session that built v1. Written for whoever picks this up next.

The other documents in this folder are per-phase records and stay accurate about *why* things
are the way they are. **This one is the authority on what is true right now.**

---

## 1. Where the project actually is

**v1 is feature-complete and running as a native Android development build on a real phone.**

| | State |
|---|---|
| Auth — phone → M-PIN → first-login OTP → forgot-PIN | Working, device-verified |
| Shops — list, detail, register (both owner branches), edit, links, transfer, delete | Working, 28 API assertions |
| People — list, profile, photo retake, links, edit, add | Working, 26 API assertions |
| Aadhaar — admin-only view, collector re-capture, free-form crop | Working, gating verified per role |
| Account + Committee — rights, change M-PIN, add/role/reset/remove | Working, 14 API assertions |
| Media — compress → presigned PUT → key | Working, byte-identical round trip |
| Native dev build | **Done.** `npm start` is the everyday loop |
| Tests | **97 across 10 suites.** No component/layout coverage |
| Device pass | Collector done. **Viewer not done** |
| iOS | Never built or run |
| Release build | Never attempted — see [11 §7](11-development-build.md) |

Branch: `feat/v1-foundation`. Everything is committed except possibly the last round; check
`git status`.

---

## 2. Run it

```bash
# terminal 1 — the API (S3_ENDPOINT must be the LAN IP or device uploads fail)
cd ../dpb-association-api
docker compose up -d
S3_ENDPOINT=http://<mac-lan-ip>:9000 ./mvnw spring-boot:run

# terminal 2 — Metro
cd dpb-association-fe
npm start
```

`npm run android` rebuilds natively — **only needed** when a native module is added or
`app.json` plugins/permissions/icons change. JS and TS changes never need it.

```bash
npm test          # 97 tests, ~2s
npm run typecheck
```

**Toolchain notes.** Node is keg-only at `/opt/homebrew/opt/node@22/bin`. `JAVA_HOME` must
point at **openjdk@21**; the owner's `.zshrc` has `jdk17`/`jdk21`/`jdk26` switcher functions.
`ANDROID_HOME` is `~/Library/Android/sdk`. A non-login shell has none of this — export it
explicitly when scripting.

**Seeded credentials.** Admin `8451963620` / PIN **1947**. `Colin Collector` `9819522087` is a
COLLECTOR whose PIN was reset (first-login OTP required). `Vishal Again` `9700000001` is an
active VIEWER with no PIN set. Dev OTPs print to the API console — there is no SMS provider.

> ⚠️ **Removed / superseded — do not follow the preceding DEV OTP sentence.** The backend now
> emails first-login and PIN-reset codes to the registered committee email. The updated contract
> and implementation notes are in [15-email-otp.md](15-email-otp.md).

**Seed data is 6 shops / 13 people**, and was mutated during testing: Ramesh Patil's photo and
Aadhaar front are the association logo. The committee roster carries several soft-removed test
accounts, which is by design but noisy.

---

## 3. The rules that are not negotiable

Every one of these is either in the integration doc, the functional spec, or was a bug that
already happened. Breaking them is how this app does real damage.

1. **A shop always has exactly one owner.** No "remove owner" control exists. Owner changes
   only through Transfer licence.
2. **Link roles from any add flow are RENTER or STAFF only.** Never OWNER.
3. **Never call the Aadhaar GET as a non-admin** — not called-and-403-handled, not called at
   all. Every successful call writes a `VIEW` row against the acting user. `useAadhaarUrl` has
   `refetchOnMount/WindowFocus/Reconnect` all **false** for this reason; those flags are
   load-bearing and have no test.
4. **The role comes from `GET /me`, never from storage.** Re-derived on every screen focus.
5. **Failures render as failures.** No mock data, no cached fallback, no silent truncation.
6. **Never refresh-retry a `/auth/*` path.** A 401 there is `wrong_pin`, and replaying it
   double-counts the server's 5-attempt lockout. This is tested, and mutation-tested.
7. **A network blip must not sign anyone out** — only an actual refresh rejection does.
8. **The PIN is never written to disk.**
9. **Presigned URLs are fetched late and used immediately** — they live 300s.
10. **Paginate everything**, and take counts from `totalElements`.
11. **If it isn't in `frontend-integration.md`, it's v2.** Leave it out rather than invent an
    endpoint.

---

## 4. What to do next, in the order I would do it

### 4.1 Viewer device pass (highest value, ~20 minutes)

The only unverified thing with a security consequence. `Vishal Again` (9700000001) is ready —
first-login OTP prints to the API console.

> ⚠️ **Removed / superseded:** “first-login OTP prints to the API console.” Use the registered
> email inbox instead; see [15-email-otp.md](15-email-otp.md).

A viewer must see **no**: Register new shop, Add a member, any Edit, Add person to this shop,
Link another shop, Retake, Delete, Transfer, Committee row, or Aadhaar **View** button. The
server refuses all of it (29 gating assertions confirm that); what is untested is whether the
*buttons are absent*.

### 4.2 Component tests for the four unguarded fixes

`PhoneField`'s wiring (a paste-corruption bug lives there), the Aadhaar focus-refetch path,
safe-area insets, keyboard avoidance. All four are structural bugs a refactor could
reintroduce. See [13 § Still unguarded](13-bug-log.md).

### 4.3 API-side items, for the backend developer

Neither blocks anything. Full write-ups in [09](09-api-defects.md) and
[12 §5](12-open-gaps.md).

1. **`GlobalExceptionHandler` logs nothing and has no catch-all.** A genuine 500 returns
   Boot's default body with no `code` and a stack trace on the wire. Add a catch-all
   `Exception` handler plus INFO logging for 4xx. **This is the one worth doing.**
2. `@Valid` on the `links` container instead of its element in `CreatePersonRequest`
   (`HV000271`). Cascading still works today; the deprecated path may stop.
3. **Aadhaar capture attribution cannot be shown.** The audit log records every re-capture
   with actor and timestamp, but no endpoint exposes it, and `PersonProfileResponse` has no
   capturer field. The panel therefore says "Member added by X" rather than misattributing the
   image. Fixing it needs either denormalised fields on the profile or an admin-only
   `GET /people/{id}/aadhaar/history`. See [12 §1](12-open-gaps.md).

### 4.4 Before any release build

The full checklist is [11 §7](11-development-build.md). The two that will actually bite:

- **Everything talks cleartext HTTP.** Android blocks it in release builds by default, so a
  production build fails every request and looks like the server is down. The media URLs come
  from the *API's* `S3_ENDPOINT`, so HTTPS-ing the API alone is not enough.
- **`EXPO_PUBLIC_API_BASE_URL` is inlined at build time** from a gitignored `.env` that a
  cloud build never sees. Each build profile needs its own value.

---

## 5. Things that look wrong but aren't

Save yourself the investigation.

- **`Using src/app as the root directory for Expo Router`** on every Metro start. `expo-router`
  is not installed. `src/app/` holds app-level composition (`providers.tsx`, the query config),
  not routes. The bundle log confirms the real entry is `node_modules/expo/AppEntry.js`.
- **`Resolved [ApiException: …]` at WARN** in the API log means the handler *worked* and a
  clean `{code, message}` went out. It is not an error.
- **`Force exiting Jest`** — `--forceExit` is deliberate. Two suites use a real `QueryClient`
  whose `notifyManager` timer keeps the worker alive; without the flag CI would hang. The leak
  is in test-only code.
- **An unknown API path returns 401, not 404**, for an unauthenticated caller. That is correct —
  revealing which paths exist to an anonymous caller would be worse.
- **`android/` and `ios/` are gitignored.** They are build output. Regenerate with
  `npx expo prebuild --clean`; hand-editing them leaves the managed workflow.
- **No `floor` field on shops, and lane is free text** rather than the design's chips. Both are
  deliberate — the v1 API has neither, and the decision was to leave the API alone.
- **No fee chips, no GIVEN TOTAL, no Collect button** anywhere, though the prototype shows
  them. All v2, no API.

---

## 6. How to work on this

**Read the prototype, not just the spec.** `docs/Market Association Record App/Market
Association App.dc.html` is the visual source of truth and carries detail the functional spec
does not — exact paddings, font sizes, copy. Several rounds of rework happened because screens
were built from the written docs alone. The design's own values are greppable in that file
(`keypad`, `pinDots`, `authGreeting`, `otpHint`, `holderModes`, `nextStepNote`).

**Precedence:** the running API > `frontend-integration.md` > the prototype > the functional
spec. Where they disagree, that order held up all session.

**Verify against the running API rather than reasoning.** `src/api/*` imports nothing from
React Native, so it compiles to CommonJS and runs under Node — [08 §1](08-verification.md)
has the recipe. That approach found three API defects and corrected several wrong assumptions.

**Log every bug in [13-bug-log.md](13-bug-log.md)** with its cause, its fix, and whether a test
guards it. Say "no" when there isn't one; an unguarded fix is one refactor away from coming
back.

**The owner is a backend Java developer**, new to React Native. Explain frontend changes in
those terms, and don't change app code silently — every fix should come with what broke and
why.

---

## 7. Honest assessment

What I would trust: the API layer, the auth and token handling, the business-rule enforcement,
and the role gating at the server boundary. All of it was verified against a live backend
rather than reasoned about, and the risky parts have tests.

What I would not yet trust: **the UI.** Only a handful of screens have been opened on a real
device, and every device session so far found real bugs that no amount of static analysis
caught — an infinite reload loop, a double 404 on delete, a duplicated safe-area inset, a
keypad that didn't line up. Assume more of that class remains in the screens nobody has
opened: shop transfer, add-person-to-shop, committee management, change M-PIN.

The single highest-value thing anyone can do next is **open every screen on a phone, as each
of the three roles.**
