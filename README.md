# Market Association Record App

Expo / React Native client for a market association committee (~1,000 shops, ~2,300 people).
Committee members sign in with a phone number and a 4-digit M-PIN and keep the register of
shops and the people attached to them.

The API is a separate Java / Spring Boot + PostgreSQL project (`../dpb-association-api`).

## Scope — read this first

**v1 is the register only: auth, Shops, People, Account, Committee.**

Everything about money — dashboard figures, Events, Fund, the collection form, receipts, the
annual fee cycle, cash handover, statements, cancelled receipts — is **v2 and has no API behind
it**. It is described in the functional spec and drawn in the prototype, but it must not be
built or stubbed here. If a screen you expect isn't in `docs/frontend-integration.md`, it's v2.

Three documents govern this repo, in order of authority for engineering questions:

| Document | What it settles |
| --- | --- |
| `docs/frontend-integration.md` | The API contract and the v1/v2 scope line. Copied verbatim from the API repo. |
| **`docs/v1/`** | **The build record, one file per phase** — what was decided, what was built, how it was proved, and what isn't covered. Start at `docs/v1/README.md`. |
| `docs/v1-implementation-plan.md` | The plan: cross-cutting decisions, the phase breakdown, resolved questions, and the invariants not to regress. |
| `docs/Market Association Record App/` | The functional spec and the interactive prototype — the visual reference. |

Where the spec and the integration doc disagree, the integration doc wins; where the
integration doc and the API's own slice docs disagree, the API wins.

## Current status

**v1 is feature-complete.** Phases 1–7 are done and verified against a running API; every
screen in integration doc §5 exists. Per-phase detail is in [`docs/v1/`](docs/v1/README.md).

| Area | State |
| --- | --- |
| Auth — phone → M-PIN → first-login OTP → forgot-PIN → set-PIN | Complete, with the §10 error routing |
| Token storage, refresh rotation, app-lock, unlock | Complete |
| HTTP client, typed errors, query cache, navigation, UI kit | Complete |
| Media — compress → presigned PUT → key | Complete |
| Shops — list, detail, register (both owner branches), edit, links, transfer, delete | Complete |
| People — list, profile, photo retake, links, edit, standalone add | Complete |
| Aadhaar — admin-only viewing, collector re-capture | Complete, verified per role |
| Account — identity, rights, Change M-PIN, lock, sign out | Complete |
| Committee — list, add, role, reset PIN, remove, with guards | Complete |
| **Automated tests** | **Phase 8 — not started.** All verification so far was by throwaway harnesses against a live API |
| **Device pass as collector / viewer** | **Not done.** The server refuses correctly; nobody has confirmed the buttons are hidden on a phone |

Before calling this shippable, read
[`docs/v1/08-verification.md` §7](docs/v1/08-verification.md#7-what-is-not-covered) — it lists
exactly what has and hasn't been proved. Also still to do: delete the `__DEV__` media harness at
`src/features/dev/`.

## Architecture

```
App.tsx → AppProviders (fonts · safe area · query cache · auth) → RootNavigator
                                                                     │
        ┌────────────────────────────────────────────────────────────┼─────────────────┐
   no tokens                          tokens + locked                        unlocked
   AuthStack                          UnlockScreen                           AppStack
   Phone → Pin → Otp → NewPin                                        MainTabs · Account
                                                                  (Shops · Home · People)
```

- **`src/api/`** — one `request()` entry point. Attaches the bearer token from an injected
  provider, times out at 20s, throws `ApiError(status, code)`, and refreshes-and-retries once on
  a 401 from a protected endpoint. `errors.ts` carries the authoritative list of every code the
  API can return.
- **`src/auth/`** — `AuthContext` owns **tokens and the app-lock only**. The user's name and role
  come from `GET /me` via `useMe()`, refetched on every screen focus, because the API re-derives
  the role from the database per request and a mid-session demotion has to land immediately.
- **`src/app/`** — the query client (`staleTime: 0`, no retry on 4xx, no retry on mutations) and
  every query key in one place so invalidation is a lookup, not a guess.
- **`src/features/<area>/`** — screens and hooks per feature area.
- **`src/components/ui/`** — the shared primitives. 44px minimum touch targets throughout.
- **`src/theme/`** — the prototype's palette, plus Instrument Serif and IBM Plex Mono.

### Rules the code depends on

1. A shop **always** has exactly one owner. The owner is created only by registration or
   transfer, and never removed — there is no "remove owner" control anywhere.
2. Link roles from any add flow are **RENTER or STAFF only**.
3. **Never call the Aadhaar endpoint as a non-admin.** Not gated-then-called — not called.
4. The role is never read from a stored login response.
5. **No mock or cached fallback for register data.** A failure renders as a failure; there is no
   offline mode and a save must never appear to succeed when it didn't.
6. The PIN is never written to disk.
7. Presigned URLs expire in ~5 minutes — fetch them immediately before use.
8. Paginate everything; counts come from `totalElements`.

## Running the app

Node 20+ required.

```bash
npm install
npm start          # then i / a / w, or scan with Expo Go
npm run typecheck
npm run fix-deps   # expo install --fix, after any SDK bump
```

### API base URL

Defaults to `http://localhost:8080/api/v1`. On a physical phone, `localhost` is the phone —
point it at your machine:

```bash
# .env at the project root
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8080/api/v1   # device on the same wifi
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080/api/v1      # android emulator
```

Restart Expo after changing `.env`.

## Running the API

```bash
cd ../dpb-association-api
docker compose up -d      # Postgres 16 + MinIO
./mvnw spring-boot:run    # http://localhost:8080/api/v1
```

Needs Java 21 and Docker. Postgres on `localhost:5432` (db/user/pass all `dpb`); MinIO API on
`:9000`, console on `:9001` (`minioadmin`/`minioadmin`).

The seeded first admin is **8451963620** with no PIN set. Sign in, request the first-login code,
and read the `DEV OTP` line from the API's console — there is no SMS provider in dev.

## Notes for production

- Override `APP_JWT_SECRET` on the API; the default is development-only.
- HTTPS for all API traffic.
- Real S3 credentials, and **enable SSE on the media bucket** — Aadhaar images live there.
- The client hides controls; the API enforces the rules. Assume a modified client.
