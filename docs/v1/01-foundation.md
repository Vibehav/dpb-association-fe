# Phase 1 — Foundation

**Goal:** the scaffolding every screen depends on — typed errors, one HTTP client, a query
cache, real navigation, a UI kit, and the prototype's typefaces. Plus removing the v2 money UI
that existed on mock data.

Nothing else could be built correctly first. The pre-refactor app switched tabs with
`useState`, which cannot express a pushed screen — and every unbuilt v1 screen is a pushed
screen.

---

## 1. What was decided

| Topic | Decision |
|---|---|
| Existing auth | **Keep and extend.** The phone → PIN → OTP flow and the single-flight 401→refresh were correct. Everything else was restructured around them. |
| v2 money UI | **Deleted, not placeholdered.** `mockData.ts` rendered fabricated ₹ figures that read as real. |
| Navigation | React Navigation: `native-stack` + `bottom-tabs`. No `gesture-handler` — native-stack doesn't need it. |
| Server state | TanStack Query. `staleTime: 0` by default so screen data refetches on mount and foreground; Home's two count queries are the intentional exception and use explicit invalidation. |
| Bottom sheets | **No Reanimated / `@gorhom/bottom-sheet`.** Multi-field flows use native-stack modal screens; destructive confirms use an in-house `Sheet` on RN `Modal`. |
| Forms | `react-hook-form` is installed but the forms hand-roll their state — the field sets are small and validation must mirror integration doc §8 exactly, which reads better as a plain `validators.ts`. |
| Fonts | Instrument Serif + IBM Plex Mono via `expo-font`. `theme/typography.ts` already named them but nothing loaded them, so no `fontFamily` was applied anywhere. |
| Tab bar | **Shops · Home · People** (3 tabs). Account opens from the header initials, not a tab. |

### Dependencies added

Eleven packages. `npx expo install --check` reports "Dependencies are up to date", so all are
SDK-54 compatible.

```
@react-navigation/native 7.3.17   @react-navigation/native-stack 7.18.9
@react-navigation/bottom-tabs 7.18.17   react-native-screens 4.16.0
@tanstack/react-query 5.101.4   react-hook-form 7.86.0
expo-file-system 19.0.24   expo-image-manipulator 14.0.8   expo-font 14.0.12
@expo-google-fonts/instrument-serif 0.4.1   @expo-google-fonts/ibm-plex-mono 0.4.1
```

---

## 2. Typed errors — `src/api/errors.ts`

The old client threw `new Error(message)`, discarding both the HTTP status and the machine
`code`. That made integration doc §10's mapping table unimplementable: `409 pin_not_set` (must
route into first-login OTP), `423 pin_locked` and `401 wrong_pin` were indistinguishable.

```ts
export class ApiError extends Error {
  readonly status: number;               // 0 for client-side failures
  readonly code: ErrorCode | string;
  get isNetworkFailure() { return this.status === 0 }
}
export function isCode(error: unknown, ...codes: string[]): error is ApiError
export function isStatus(error: unknown, ...statuses: number[]): error is ApiError
```

`SERVER_ERROR_CODES` holds **31 codes**, transcribed from every `ApiException.*("<code>", …)`
throw site in `dpb-association-api` plus the two written directly by `GlobalExceptionHandler`
and `SecurityConfig`. Integration doc §10 lists only 13 of them; the rest were found by
grepping the API source. `CLIENT_ERROR_CODES` adds four the client synthesises:
`network_error`, `timeout`, `upload_failed`, `unknown`.

`apiErrorFromBody(status, rawBody)` parses the `{ code, message }` envelope and degrades
sensibly when the body isn't one — a proxy's HTML, or Boot's default error JSON, which has no
`code` field.

`errorMessage(error)` returns display copy. It prefers the server's `message` (they are well
written and stay correct as rules change) except for a short `OVERRIDE_MESSAGES` map where the
server's wording isn't the right thing to show a collector standing in a market.

---

## 3. The HTTP client — `src/api/client.ts`

One entry point:

```ts
request<T>(path, { method?, body?, query?, auth?, signal?, timeoutMs? }): Promise<T>
```

- **Token injection.** `configureClient({ getAccessToken, getRefreshToken, onTokensRefreshed,
  onSessionExpired })` is wired once by `AuthProvider`. Feature APIs no longer thread a `token`
  argument through every call — essential once calls live inside query hooks.
- **`body` is a plain object**, serialised per attempt. That is what makes a retry safe to
  replay.
- **`query` omits** `undefined`, `null` and `""`. The old client always sent `query=`.
- **20s timeout** via `AbortController`.
- **Refresh-and-retry once** on a 401 from a protected endpoint, single-flighted so a burst of
  parallel 401s performs exactly one refresh.
- **`forceRefresh()`** is exported for the app-unlock flow (see [02](02-auth.md)).

### Two subtleties worth not undoing

**Never refresh-retry `/auth/*`.** A 401 there means `wrong_pin`, `invalid_refresh` or
`invalid_reset_token` — none of which a replay fixes. For `verify-pin` a replay was actively
harmful; see [09 §1](09-api-defects.md#1-wrong-m-pin-was-counted-twice-frontend-fixed).

**A network blip must not destroy a valid session.** `refreshAccessToken` only calls
`onSessionExpired` when the refresh was actually *rejected*. An `ApiError` with `status === 0`
returns null without clearing anything — signing someone out on a dropped packet in a market
basement would be miserable.

**Timeouts are tracked with a flag, not an abort reason.** RN's `AbortController` is a polyfill
that ignores `abort(reason)`, and `DOMException` isn't reliably defined on Hermes — constructing
one would throw a `ReferenceError` instead of timing out.

---

## 4. Query cache — `src/app/queryClient.ts`, `queryKeys.ts`

```ts
staleTime: 0          // every mount and foreground refetches — §2.3
gcTime: 5 min
retry: no 4xx         // an answer, not a hiccup. status 0 and 5xx get one more go
retryDelay: 2^n capped at 5s
mutations: retry false // never silently replay a write; there is no offline mode
```

`wireAppStateFocus()` points React Query's `focusManager` at RN `AppState`, since its default
focus detection is a browser API.

`queryKeys` holds every key in one place so invalidation is a lookup, not a guess. Keys are
hierarchical — invalidating `shops.all` also invalidates every filtered list and detail below it.

`useRefreshOnFocus(refetch)` covers the gap React Query doesn't: popping back to a screen that
stayed mounted underneath a pushed one. It skips the first focus because mount already fetched.

### Home count exception

`src/features/home/useCounts.ts` reads `totalElements` from the one-row `shops` and `people`
pages. Those two queries use the existing `queryKeys.shops.list(COUNT_ONLY)` and
`queryKeys.people.list(COUNT_ONLY)` keys with `staleTime: Infinity`; they are fetched on the
first Home load and then retained until an explicit action changes them. Home deliberately does
not use `useRefreshOnFocus`.

Pull-to-refresh and Home's error retry call both hooks' `refetch()` functions. Shop
create/delete invalidates the shop count; member create/delete invalidates the member count.
The broad list/detail invalidations used by other writes exclude these count entries, so a link
or edit cannot incidentally refetch a Home total. A shop registration with an inline new owner
also invalidates the people count because it creates a person.

---

## 5. Providers — `src/app/providers.tsx`

`AppProviders` = fonts gate → `SafeAreaProvider` → `QueryClientProvider` → `AuthProvider`.

The `QueryClient` is created once via `useState(createQueryClient)`; recreating it would drop
every cache entry on re-render.

`SessionCacheReset` watches auth status and calls `queryClient.clear()` when it becomes
`signedOut`. Without it, signing out and back in as a different member would briefly serve the
previous user's `/me`, shops and people from cache — including their role, which is precisely
the thing that must never be stale.

---

## 6. Navigation

```
App.tsx → AppProviders → RootNavigator
   status "loading"    → LoadingScreen
   status "locked"     → UnlockScreen        (outside NavigationContainer — it's a state, not a route)
   status "signedOut"  → AuthStack           Phone → Pin → Otp → NewPin
   status "ready"      → AppStack
                           Tabs (Shops · Home · People) + Account
                           ShopDetail, ShopForm*, ShopAddPerson*, ShopTransfer*
                           PersonProfile, PersonEdit*, AddMember*
                           ChangePin*, Committee, AddCommitteeMember*
                           MediaCheck*  (__DEV__ only)
                                                            * = presentation: "modal"
```

`navigation/types.ts` holds typed param lists. **Only registered routes appear there** — a
param-list entry with no screen behind it typechecks at the call site and then crashes at
runtime.

`RootNavigator` wraps the signed-in tree in a `View` with
`onStartShouldSetResponderCapture={() => { recordActivity(); return false }}`. That observes
every touch to reset the inactivity timer without intercepting it; `onTouchStart` on a
non-responder view is unreliable.

`MainTabs` draws its own header (`AppHeader`) rather than using the navigator's, so the title,
the `name · role` line and the initials avatar match the prototype. The avatar navigates to
`Account`, which bubbles up from the tab navigator to the parent stack.

---

## 7. UI kit — `src/components/ui/`

Replaces a single 384-line flat `StyleSheet` (`styles.ts`) that every screen imported from.

`Screen` `Button` `Card` `Avatar` `Field` `PhoneField` `SearchBox` `Chip`/`ChipRow`
`CheckRow` `EmptyState` `ErrorState` `Banner` `LoadingScreen` `Sheet` `ConfirmSheet`
`ListFooter`

Notes:

- **`MIN_TOUCH = 44`** is applied to every interactive primitive. Spec §13.4 makes it a hard
  floor — collectors use this one-handed, standing.
- **`ErrorState` is deliberately distinct from `EmptyState`**: "we couldn't find out" versus
  "there's nothing here". It detects `isNetworkFailure` and switches to offline copy.
- **`Sheet`** is RN `Modal` + a bottom panel. `ConfirmSheet` builds on it and always spells out
  the consequence ("this unlinks everyone at the shop").
- **`ListFooter`** never silently stops — loading, retry-on-failure, or an end label.
- `PhoneField` strips non-digits as you type, so a pasted `+91 98200 00000` lands as
  `9820000000`; the API wants bare digits.

`components/auth/CodeDots` and `Keypad` are **length-parameterised**. The old `PinDots`
hardcoded four dots, which is why the 6-digit OTP step had fallen back to a plain `TextInput`
and lost the designed keypad.

---

## 8. Theme — `src/theme/`

`colors.ts` was already correct and matches the prototype exactly; untouched.

`fonts.ts` adds `useAppFonts()`, which the provider gates on so text doesn't reflow after first
paint. It returns true on load *error* as well as success — a missing font must not block
sign-in.

`typography.ts` became a real scale lifted from the prototype's inline styles (`display` 25pt
serif, `title` 20pt serif, `cardTitle`, `body` 12.5, `bodySmall` 11.5, `eyebrow` 10 mono
uppercase, `mono`, `button`, `tabLabel`). `spacing.ts` gained `radii` and `MIN_TOUCH`. Both
files existed before and were imported by nothing.

---

## 9. The v2 teardown

Deleted: `src/mockData.ts`, `screens/money/FundScreen.tsx`, `screens/money/EventsScreen.tsx`,
`screens/committee/CommitteePlaceholder.tsx`, `src/api.ts` (a loose barrel),
`src/types/index.ts`, `src/context/AuthContext.tsx`, `navigation/AuthNavigator.tsx`,
`components/ui/styles.ts`, `Metric.tsx`, `SmallCard.tsx`, `PrimaryButton.tsx`,
`components/auth/PinDots.tsx`, the `Dashboard` / `EventSummary` types,
`Shop.feeStatus` / `feeDue`, and three empty `.gitkeep` component directories.

Also removed: **the silent mock fallback**. `MainTabs.loadData()` caught any list failure and
substituted `shopsMock`/`peopleMock`, so one dropped request rendered five invented shops as
though they were the register.

`HomeScreen` was rewritten to integration doc §5.1 — two real counts from `totalElements` on
`?size=1`, two shortcuts, nothing else. The Fund and Events tabs are gone.

The files removed outright account for **1,372 lines**.

Note that `git diff --stat main` understates the overall change, because almost all new code
lives in new files that are still untracked (91 of them at the time of writing). The tracked
diff reads roughly *1,300 insertions / 2,180 deletions* across phases 1–7 — i.e. the visible
delta is dominated by deletions until the new files are staged.

---

## 10. Verification

- `tsc --noEmit` clean.
- `expo install --check` → "Dependencies are up to date".
- Against a running API: `/actuator/health` UP; `POST /auth/phone` returns
  `{onCommittee, firstName, pinSet}` matching `PhoneCheckResponse` exactly, and
  `{onCommittee:false, firstName:null, pinSet:null}` for an unknown number — confirming the
  `| null` typing. `401 unauthorized`, `401 invalid_refresh` and `400 validation_error`
  envelopes all parse into `ApiError` with the right code.

---

## 11. Gotchas

1. **`DOMException` on Hermes.** See §3. The first draft used
   `controller.abort(new DOMException("timeout", "TimeoutError"))`, which would have thrown a
   `ReferenceError` on device instead of producing a timeout.
2. **`React.ReactNode` without importing React.** Resolves via the `@types/react` UMD global so
   `tsc` passes, but it's sloppy — use `import type { ReactNode }`.
3. **The unlock screen must sit outside `NavigationContainer`.** It's a modal state over an
   existing session, not a route, and nothing on it navigates.
4. **Fonts must be gated, not awaited lazily.** Rendering before they load causes a visible
   reflow on a screen whose whole character is the serif numerals.
5. **`useRefreshOnFocus` must not depend on its callback's identity.** The first version listed
   `refetch` in the `useCallback` deps, which turned any inline arrow at the call site into an
   infinite refetch loop. Home hit it. See
   [10 §1](10-design-review-fixes.md#1-home-reloaded-continuously-bug-fixed).
