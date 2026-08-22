# Market Association Record App

Expo/React Native frontend for a market association committee app. The app lets committee users sign in with phone number + M-PIN, view shop and people register data, and lays out placeholder/demo screens for fund and event tracking.

The backend is included separately as `dpb-association-api.zip`. It is a Java/Spring Boot API with PostgreSQL, Flyway migrations, JWT auth, committee users, shops, people, links, and media upload support.

## Current status

Auth is complete for the current V1 backend scope. The app covers phone lookup, M-PIN login, first-login PIN setup, forgot/reset M-PIN, session restore, secure token storage, access-token refresh, logout, and unlock with M-PIN.

Completed in the frontend:

- Phone number lookup and committee-only login flow.
- First-login OTP flow for users who do not have a PIN yet.
- Forgot/reset M-PIN flow.
- Secure token/session storage with `expo-secure-store`.
- Automatic access-token refresh on `401` responses.
- App unlock screen that re-checks M-PIN after inactivity using `/auth/verify-pin`.
- Backend-backed list loading for shops and people.
- Role-aware tab visibility: admins see Fund, collectors/viewers do not.
- Account page with sign out.
- Demo dashboard, fund, and event screens while money APIs are not available.

Still missing or partial:

- Create/edit/detail screens for shops and people.
- Committee management screens, although `committeeApi` exists.
- Real dashboard, fund, event, fee, receipt, and expense APIs.
- Image capture/upload UI for member photos, Aadhaar, and bills.
- Aadhaar view/recapture UI with admin-only access.
- Pagination UI for shops and people; current API wrapper loads page `0` with size `50`.
- Better production error handling for register list loading. It currently falls back to demo data if shop/person loading fails.
- Automated tests.

## How to run the frontend

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

Run in web mode:

```bash
npm run web
```

Type-check the app:

```bash
npm run typecheck
```

## Frontend API URL

The default API base URL is:

```text
http://localhost:8080/api/v1
```

Configured in:

```text
src/api/client.ts
```

For a physical phone, `localhost` means the phone itself, not your laptop. Create a `.env` file at the project root and use your computer's local network IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8080/api/v1
```

For Android emulator, this is often:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080/api/v1
```

Restart Expo after changing `.env`.

## How to run the backend

The backend is inside:

```text
dpb-association-api.zip
```

Unzip it:

```bash
unzip dpb-association-api.zip
cd dpb-association-api
```

Start local Postgres and MinIO:

```bash
docker compose up -d
```

Run the Spring Boot API:

```bash
./mvnw spring-boot:run
```

The API runs at:

```text
http://localhost:8080/api/v1
```

Backend requirements:

- Java 21
- Docker
- PostgreSQL 16 from `compose.yaml`
- MinIO from `compose.yaml`

Default local services:

- Postgres: `localhost:5432`, database/user/password all `dpb`
- MinIO API: `localhost:9000`
- MinIO console: `localhost:9001`
- MinIO login: `minioadmin` / `minioadmin`

The backend README says the seeded first admin phone is:

```text
8451963620
```

For first login, request OTP in the app and read the `DEV OTP` printed in the backend terminal.

## Endpoint coverage

### Auth endpoints

| Endpoint | Frontend status | UI / file |
| --- | --- | --- |
| `POST /api/v1/auth/phone` | Complete | Phone step in `LoginScreen.tsx`, via `authApi.lookupPhone()` |
| `POST /api/v1/auth/login` | Complete | M-PIN step in `LoginScreen.tsx`, via `signIn()` |
| `POST /api/v1/auth/otp/request` | Complete | First-login and forgot PIN flows in `LoginScreen.tsx` |
| `POST /api/v1/auth/otp/verify` | Complete | OTP step in `LoginScreen.tsx` |
| `POST /api/v1/auth/pin/set` | Complete | New M-PIN step in `LoginScreen.tsx` |
| `POST /api/v1/auth/token/refresh` | Complete | Automatic refresh in `client.ts` + `AuthContext.tsx` |
| `POST /api/v1/auth/logout` | Complete | Account screen and unlock screen sign-out |
| `POST /api/v1/auth/verify-pin` | Complete | Unlock screen after inactivity |
| `GET /api/v1/me` | Complete | Called after login and PIN setup to load user info |

### Register endpoints

| Endpoint | Frontend status | Notes |
| --- | --- | --- |
| `GET /api/v1/shops` | Partial | Used by `shopsApi.list()` and `ShopsScreen.tsx` |
| `GET /api/v1/shops/{id}` | Missing UI | Detail API wrapper not added yet |
| `POST /api/v1/shops` | Missing UI | Register button exists but is not wired |
| `PATCH /api/v1/shops/{id}` | Missing UI | Edit screen not built |
| `DELETE /api/v1/shops/{id}` | Missing UI | Admin delete flow not built |
| `POST /api/v1/shops/{id}/links` | Missing UI | Add renter/staff flow not built |
| `POST /api/v1/shops/{id}/transfer` | Missing UI | Admin transfer flow not built |
| `DELETE /api/v1/links/{linkId}` | Missing UI | Link removal flow not built |
| `GET /api/v1/people` | Partial | Used by `peopleApi.list()` and `PeopleScreen.tsx` |
| `GET /api/v1/people/{id}` | Missing UI | Profile screen not built |
| `POST /api/v1/people` | Missing UI | Add member button exists but is not wired |
| `PATCH /api/v1/people/{id}` | Missing UI | Edit person flow not built |
| `POST /api/v1/people/{id}/links` | Missing UI | Link member to shop flow not built |
| `DELETE /api/v1/people/{id}` | Missing UI | Admin delete flow not built |

### Media endpoints

| Endpoint | Frontend status | Notes |
| --- | --- | --- |
| `POST /api/v1/media/upload-url` | API wrapper only | `mediaApi.uploadUrl()` exists |
| `GET /api/v1/people/{id}/photo` | Missing UI | Signed photo view not built |
| `PUT /api/v1/people/{id}/photo` | Missing UI | Photo retake not built |
| `GET /api/v1/people/{id}/aadhaar/{side}` | Missing UI | Admin-only Aadhaar view not built |
| `PUT /api/v1/people/{id}/aadhaar` | Missing UI | Aadhaar recapture not built |

### Committee endpoints

| Endpoint | Frontend status | Notes |
| --- | --- | --- |
| `GET /api/v1/committee` | API wrapper only | `committeeApi.list()` exists |
| `GET /api/v1/committee/{id}` | API wrapper only | `committeeApi.detail()` exists |
| `POST /api/v1/committee` | API wrapper only | `committeeApi.add()` exists |
| `PATCH /api/v1/committee/{id}` | API wrapper only | `committeeApi.changeRole()` exists |
| `POST /api/v1/committee/{id}/reset-pin` | API wrapper only | `committeeApi.resetPin()` exists |
| `DELETE /api/v1/committee/{id}` | API wrapper only | `committeeApi.remove()` exists |

### Money/event endpoints

The frontend has dashboard, fund, and event UI screens, but these use mock data. The backend README says money features are a later phase and are not part of the current backend.

## App flow

1. `App.tsx` wraps the app with `AuthProvider`.
2. `RootNavigator.tsx` decides what to show:
   - loading spinner while restoring session
   - `LoginScreen` when signed out
   - `UnlockScreen` when signed in but locked
   - `MainTabs` when signed in and unlocked
3. `LoginScreen.tsx` handles:
   - phone lookup
   - PIN login
   - first-login OTP
   - forgot PIN OTP
   - set new PIN
4. `AuthContext.tsx` stores tokens and user info in SecureStore.
5. API wrappers use `request()` from `client.ts`.
6. If a protected request returns `401`, `client.ts` refreshes the access token once and retries the request.
7. After inactivity, `AuthContext.tsx` sets `locked=true`.
8. `UnlockScreen.tsx` asks for M-PIN and calls `/auth/verify-pin`.

## File guide

### Root files

| File | Purpose |
| --- | --- |
| `App.tsx` | App entry component; wraps navigation in `AuthProvider`. |
| `app.json` | Expo app configuration. |
| `babel.config.js` | Expo Babel preset configuration. |
| `package.json` | Scripts and dependencies. |
| `package-lock.json` | Locked npm dependency versions. |
| `tsconfig.json` | TypeScript configuration. |
| `dpb-association-api.zip` | Zipped Spring Boot backend source/project. |
| `uploads/logo-1784996881407.jpeg` | Logo used on auth and unlock screens. |
| `Market Association App.dc.html` | Design/documentation HTML artifact. |
| `Market Association App - Functional Spec.dc.html` | Functional spec HTML artifact. |
| `doc-page.js` | Support script for documentation HTML. |
| `support.js` | Support script for documentation HTML. |

### API files

| File | Purpose |
| --- | --- |
| `src/api.ts` | Convenience barrel export for API, types, and format helpers. |
| `src/api/index.ts` | Barrel export for API modules. |
| `src/api/client.ts` | Shared fetch client, base URL, JSON/error parsing, auth header injection, automatic token refresh. |
| `src/api/authApi.ts` | Auth endpoints: phone lookup, login, OTP, set PIN, refresh, logout, verify PIN, me. |
| `src/api/shopsApi.ts` | Shop list endpoint wrapper and backend-to-UI mapping. |
| `src/api/peopleApi.ts` | People list endpoint wrapper and backend-to-UI mapping. |
| `src/api/committeeApi.ts` | Committee management endpoint wrappers; UI not built yet. |
| `src/api/mediaApi.ts` | Presigned upload URL wrapper; UI not built yet. |

### Auth and context

| File | Purpose |
| --- | --- |
| `src/context/AuthContext.tsx` | Stores/restores session, signs in/out, refreshes tokens, tracks inactivity, unlocks with M-PIN. |
| `src/screens/auth/LoginScreen.tsx` | Multi-step auth UI for phone, PIN, OTP, and new PIN. |
| `src/screens/auth/UnlockScreen.tsx` | Re-checks M-PIN after inactivity using `/auth/verify-pin`. |
| `src/components/auth/Keypad.tsx` | Reusable numeric keypad for PIN input. |
| `src/components/auth/PinDots.tsx` | Reusable four-dot PIN indicator. |

### Navigation

| File | Purpose |
| --- | --- |
| `src/navigation/RootNavigator.tsx` | Chooses login, unlock, or main app based on auth state. |
| `src/navigation/AuthNavigator.tsx` | Auth navigator wrapper; currently returns `LoginScreen`. |
| `src/navigation/MainTabs.tsx` | Main tab shell, header, account toggle, backend/mock data loading, role-aware tabs. |

### Screens

| File | Purpose |
| --- | --- |
| `src/screens/home/HomeScreen.tsx` | Dashboard summary cards using `Dashboard` data; currently mock-backed. |
| `src/screens/shops/ShopsScreen.tsx` | Shop list and search UI; list is backend-backed when API is reachable. |
| `src/screens/people/PeopleScreen.tsx` | People list and search UI; list is backend-backed when API is reachable. |
| `src/screens/account/AccountScreen.tsx` | Shows current user details and sign-out button. |
| `src/screens/money/FundScreen.tsx` | General fund screen using mock dashboard data. |
| `src/screens/money/EventsScreen.tsx` | Event fund list using mock event data. |
| `src/screens/committee/CommitteePlaceholder.tsx` | Placeholder for future committee management UI. |

### UI components and styling

| File | Purpose |
| --- | --- |
| `src/components/ui/PrimaryButton.tsx` | Shared button component with icon and loading state. |
| `src/components/ui/SearchBox.tsx` | Shared search input. |
| `src/components/ui/Metric.tsx` | Label/value metric block used on dashboard and event cards. |
| `src/components/ui/SmallCard.tsx` | Compact dashboard card component. |
| `src/components/ui/styles.ts` | Shared React Native styles for screens, cards, auth, tabs, inputs, and buttons. |

### Theme, types, utilities, mock data

| File | Purpose |
| --- | --- |
| `src/theme/colors.ts` | App color tokens. |
| `src/theme/spacing.ts` | Spacing tokens. |
| `src/theme/typography.ts` | Typography tokens. |
| `src/theme/index.ts` | Theme barrel export. |
| `src/types/index.ts` | Shared frontend types for user, session, dashboard, shop, person, events, committee. |
| `src/utils/format.ts` | Formatting helpers for money, initials, and title case. |
| `src/mockData.ts` | Demo dashboard, shops, people, and events used when backend modules are missing or unreachable. |

## Backend project structure inside the zip

After unzipping `dpb-association-api.zip`, the important backend files are:

| File / folder | Purpose |
| --- | --- |
| `README.md` | Backend-specific documentation and API reference. |
| `pom.xml` | Maven/Spring Boot dependencies and build config. |
| `compose.yaml` | Local Postgres and MinIO services. |
| `src/main/resources/application.yaml` | Database, JWT, OTP, PIN, and S3/MinIO config. |
| `src/main/resources/db/migration/` | Flyway database migrations. |
| `src/main/java/in/dpbmandal/api/auth/` | Auth controllers, services, DTOs, OTP, refresh tokens. |
| `src/main/java/in/dpbmandal/api/security/` | JWT filter, Spring Security config, current user principal. |
| `src/main/java/in/dpbmandal/api/committee/` | Committee user management and roles. |
| `src/main/java/in/dpbmandal/api/shop/` | Shop entity, controller, service, repository, DTOs. |
| `src/main/java/in/dpbmandal/api/person/` | Person entity, controller, media controller, service, repository, DTOs. |
| `src/main/java/in/dpbmandal/api/link/` | Shop/person link roles and link audit. |
| `src/main/java/in/dpbmandal/api/media/` | S3/MinIO presigned upload/download support. |
| `src/main/java/in/dpbmandal/api/audit/` | Aadhaar access logging. |
| `src/main/java/in/dpbmandal/api/common/` | Shared config, errors, auditing base entity, pagination response. |

## Recommended next build order

1. Add shop detail screen using `GET /shops/{id}`.
2. Add shop registration form using `POST /shops`.
3. Add person profile screen using `GET /people/{id}`.
4. Add member creation/linking forms using `POST /people` and `POST /people/{id}/links`.
5. Add media capture/upload flow using `POST /media/upload-url`.
6. Add committee management screens for admin users.
7. Replace dashboard/fund/event mock data once backend money endpoints exist.
8. Add tests for auth refresh, unlock flow, and API mapping.

## Notes for production

- Override `APP_JWT_SECRET` on the backend; the default is development-only.
- Use HTTPS for production API traffic.
- Configure real S3 credentials or production object storage.
- Do not rely on the frontend to enforce permissions. The backend already re-checks roles on every request.
- Avoid shipping backend zip contents such as `target/`, `.git/`, and `.idea/` in a production artifact.
