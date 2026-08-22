# Moving off Expo Go — development and production builds

What has to happen before this app runs as a real binary, and what that unlocks (including
free-form Aadhaar cropping).

Nothing here is urgent *today* — everything built so far runs in Expo Go. But a release build
is not optional, so the items in §3 have to be dealt with eventually, and some are easier to
fix now than later.

---

## 1. Why we're on Expo Go, and whether that was a hardware decision

This is a **managed Expo project**: there is no `android/` or `ios/` directory, and
`package.json` boots through `node_modules/expo/AppEntry.js`. Expo Go is simply what that
workflow gives you by default — `create-expo-app` produces exactly this, so it is far more
likely to be the default path than a deliberate choice.

**If the concern was that a laptop can't handle native builds, that concern is solvable
without buying anything: `eas build` compiles in Expo's cloud.** You need an Expo account
(free tier is enough for occasional builds) and nothing else — no Android Studio, no Xcode, no
Gradle. The local route (§4b) is faster once set up but does need the toolchain installed.

### What Expo Go actually is, in Flutter terms

`flutter run` always compiles a real app: your Dart plus every plugin's native code. There is
no Flutter equivalent of Expo Go, because Flutter always builds.

React Native's equivalent of `flutter run` is `npx expo run:android`. **Expo Go is an extra
shortcut Flutter doesn't have**: a pre-built app on the store containing a fixed set of native
modules, into which only your *JavaScript bundle* is loaded. Hence the QR code and the
two-second start.

The cost: you can only use native modules already compiled into it.

| | Compile native? | Fast refresh? | Your own native modules? |
|---|---|---|---|
| **Expo Go** | No | Yes | **No** — only what's baked in |
| **Development build** | Once | **Yes** | **Yes** |
| **Production build** | Yes | No | Yes |

**A development build is not a downgrade.** It's your own Expo Go: same QR, same instant
refresh, compiled with your module set. You rebuild only when you add another native
dependency.

---

## 2. What Expo Go already includes

Worth knowing before assuming a dev build is needed. Expo Go bundles the Expo SDK modules
plus several common third-party ones — notably **`react-native-reanimated`,
`react-native-gesture-handler`** and `react-native-svg`.

Consequences:

- `@gorhom/bottom-sheet` (pure JS over those two) **would run in Expo Go.** An earlier note in
  the plan claimed it needed a native rebuild; that was wrong. The decision to use native-stack
  modals instead still stands on simplicity grounds, but not on that reason.
- A **hand-built crop overlay** also runs in Expo Go — see §6, option A.
- `react-native-image-crop-picker` does **not**: it ships its own native code.

Verify rather than trust this list: `npx expo install <lib>` then run. A module missing from
Expo Go fails immediately and loudly with "native module not found", not subtly.

---

## 3. Pre-flight — four things that will bite

These block or degrade a real build regardless of which route you take.

### 3.1 The app icon is a 640×640 progressive JPEG (**must fix**)

```
app.json  icon                        → ./uploads/logo-1784996881407.jpeg
          splash.image                → same file
          android.adaptiveIcon        → same file
```

Expo wants **PNG at 1024×1024** for the icon. A 640×640 progressive JPEG will at best be
upscaled and at worst rejected. macOS can convert it without installing anything:

```bash
mkdir -p assets
sips -s format png uploads/logo-1784996881407.jpeg --out assets/icon.png
sips -z 1024 1024 assets/icon.png
cp assets/icon.png assets/splash.png
cp assets/icon.png assets/adaptive-icon.png
```

Then repoint all three `app.json` keys at `./assets/…`. Note iOS icons must have **no
transparency**, and the Android adaptive icon's artwork should sit inside the middle ~66% or it
gets cropped by the launcher mask.

Leave `uploads/logo-1784996881407.jpeg` where it is — `AuthShell` and `UnlockScreen` `require`
it for the on-screen logo, which is a separate concern from the launcher icon.

### 3.2 Everything talks cleartext HTTP (**must fix before production**)

```
.env                 EXPO_PUBLIC_API_BASE_URL=http://192.168.0.100:8080/api/v1
client.ts fallback   http://localhost:8080/api/v1
presigned media URLs http://<host>:9000/dpb-media/...   (from the API's S3_ENDPOINT)
```

**Android blocks cleartext HTTP in release builds by default.** Debug builds allow it, so a
*development* build will keep working — but a production build will fail every request, and it
will look like the server is down rather than a policy block.

Two options, in order of preference:

1. **Put the API and object storage behind HTTPS** before release. This is the right answer;
   it's also required for anything handling Aadhaar images.
2. Temporarily allow cleartext, for internal testing only:

```json
["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]
```

Do not ship that. Note the media URLs are generated by the **API's** `S3_ENDPOINT`, so
HTTPS-ing the API alone isn't enough — object storage needs it too.

### 3.3 Environment variables aren't in the build

`EXPO_PUBLIC_API_BASE_URL` currently lives in a gitignored `.env`, which EAS Build never sees.
`EXPO_PUBLIC_*` values are **inlined into the JS bundle at build time**, so each profile needs
its own:

```json
"env": { "EXPO_PUBLIC_API_BASE_URL": "https://api.example.in/api/v1" }
```

Because they're inlined and shipped, never put a secret in an `EXPO_PUBLIC_*` variable — treat
them as public. (There are none today; the base URL is all we use.)

### 3.4 No version codes

`app.json` has `version: "0.1.0"` and no `android.versionCode` / `ios.buildNumber`. Let EAS
manage them with `"autoIncrement": true` on the production profile rather than bumping by hand.

---

## 4. Doing the build

### 4a. EAS Build (cloud) — recommended, no local toolchain

```bash
npm i -D eas-cli
npx eas login                  # free Expo account
npx eas init                   # writes extra.eas.projectId into app.json
npx expo install expo-dev-client
```

`eas.json` at the project root:

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_BASE_URL": "http://192.168.0.100:8080/api/v1" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_BASE_URL": "http://192.168.0.100:8080/api/v1" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_BASE_URL": "https://REPLACE-ME/api/v1" }
    }
  }
}
```

```bash
npx eas build --profile development --platform android
```

You get a download link for an APK. Install it, then:

```bash
npx expo start --dev-client
```

Same QR, same fast refresh — it opens in *your* build instead of Expo Go.

`buildType: "apk"` matters for the development and preview profiles: the default is AAB, which
you cannot sideload onto a phone.

### 4b. Local build — faster loop, needs the toolchain

```bash
npx expo run:android      # JDK 17 + Android Studio SDK + ANDROID_HOME
npx expo run:ios          # Xcode (Mac only — you have one)
```

This runs `expo prebuild`, which **generates `android/` and `ios/` directories**. Two things
follow:

- Keep them **gitignored** and treat them as build output. Changes to `app.json` only reach
  them via `npx expo prebuild --clean`.
- If you ever hand-edit files inside them, you've left the managed workflow and `--clean` will
  wipe your edits.

### 4c. When you must rebuild

Only when the native layer changes: adding or removing a native module, changing `app.json`
plugins/permissions/icons, or bumping the Expo SDK. Pure JS and TypeScript changes never need
a rebuild — that's the whole point of the dev client.

---

## 5. iOS specifics

Not needed yet (the committee is on Android), but for completeness: a development build on a
*physical* iPhone needs an Apple Developer account (₹8,900/year) for provisioning. The iOS
**simulator** does not. Android has no equivalent cost.

---

## 6. Free-form Aadhaar cropping

**Today:** `expo-image-picker` gives a fixed 86:54 card-shaped crop on Android and no crop on
iOS (iOS forces a square crop regardless of `aspect`, which would slice the ends off the card).
There is **no free-form crop in `expo-image-picker` on either platform.**

Two ways to get one.

### Option A — stay in Expo Go, build the crop UI

`expo-image-manipulator` already has a `crop` action (we use its `resize` today). Add a
draggable/resizable box over the captured image and pass the resulting rect.

- Needs `react-native-gesture-handler` + `react-native-reanimated` — **both bundled in Expo Go**
  (§2), so no build required.
- Works today, on both platforms, genuinely free-form.
- Roughly a day of fiddly gesture work, plus our own bugs to find. Pinch-zoom, edge clamping
  and rotation all have to be written.
- Reverses the plan's decision 0.6 (avoid Reanimated), though §2 shows that decision's stated
  reason was wrong anyway.

### Option B — development build + `react-native-image-crop-picker` (recommended)

```bash
npx expo install react-native-image-crop-picker
```

```ts
import ImageCropPicker from "react-native-image-crop-picker";

const image = await ImageCropPicker.openCamera({
  cropping: true,
  freeStyleCropEnabled: true,   // ← the thing we can't get from expo-image-picker
  mediaType: "photo"
});
```

- Mature, well-tested crop UI with free-form, rotation and pinch-zoom on both platforms.
- Native module, so it **requires a development build**.
- Under managed Expo it needs its iOS usage strings declared in `app.json`:

```json
"ios": { "infoPlist": {
  "NSCameraUsageDescription": "Capture member photos and Aadhaar images.",
  "NSPhotoLibraryUsageDescription": "Attach member photos and Aadhaar images."
}}
```

  Whether it needs anything beyond that under Expo prebuild is **unverified** — check on the
  first build.

### Recommendation

**Option B, at the same time as the dev build you need for release anyway.** Writing a crop
UI is a lot of gesture code to maintain for something a library does better, and doing both
together means one build cycle rather than two.

### Where the change lands

**One file: `src/media/useImageCapture.ts`.** All capture goes through `launch()` and
`pickerOptions()`, so swapping the picker for Aadhaar touches nothing else — not `MemberForm`,
not `AadhaarPanel`, not `upload.ts`. Keep `expo-image-picker` with its 1:1 crop for the member
photo (a face in a circle *should* be square) and use the new cropper only for
`AADHAAR_FRONT` / `AADHAAR_BACK`.

The contract `useImageCapture` exposes — `state`, `key`, `previewUri`, `busy`, `retry` — does
not change, so [the media contract](04-media.md) and everything downstream of it are unaffected.

---

## 7. Production build checklist

Beyond §3:

- [ ] API and object storage on **HTTPS** with a real certificate
- [ ] `APP_JWT_SECRET` overridden on the API (the default is dev-only)
- [ ] Real S3 credentials, **SSE enabled** on the media bucket — Aadhaar images live there
- [ ] `production` profile env pointing at the real API
- [ ] Delete `src/features/dev/` and its two registrations (§ the `__DEV__` media harness)
- [ ] Android: signing keystore held by EAS, `versionCode` auto-incrementing
- [ ] Test on a **real committee phone** on mobile data, not just office wifi — the whole app
      assumes patchy signal and there is no offline mode
- [ ] Confirm the `Resolved [ApiException…]` log noise and `HV000271` are dealt with on the API
      ([09](09-api-defects.md), [10 §8.5](10-design-review-fixes.md))

---

## 8. What I haven't verified

Honest list, because none of this has been run:

- No build of any kind has been attempted. Every command above is from the documented
  workflow, not from having watched it succeed here.
- Whether `react-native-image-crop-picker` needs more than the `infoPlist` entries under Expo
  prebuild.
- Whether the Expo Go module list in §2 is exactly right for SDK 54 — verify by installing and
  running, which fails loudly if wrong.
- The icon conversion commands use macOS `sips`; the output should be eyeballed at 1024×1024
  before shipping.
