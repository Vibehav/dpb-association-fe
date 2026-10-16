# Receipt PDF on WhatsApp — plan

> **Status:** implemented · 2026-10-04 · branch `feature/v2-money` — 222 tests green; needs a new
> Android build to try on a phone (see *Dependencies*).

**Goal.** "Send receipt on WhatsApp" opens WhatsApp **in the member's chat with the receipt
PDF already attached**, so the collector only taps Send. Today it opens a `wa.me` link with the
receipt as text, because a link cannot carry a file.

## Scope

- **Frontend only.** No backend change, no new endpoint, **no S3**. The PDF is made on the phone
  from the receipt the app already loads (`GET /contributions/{id}`), handed to WhatsApp, and not
  kept. The ledger row is the record; the PDF is a view of it and can be made again any time.
- **Android only.** No iOS for now.

Decided with the client (2026-10-04): PDF made app-side rather than on the server (no new load
on the t4g.small, no storage, no reconciler changes), and not stored.

## Flow — on tapping "Send receipt on WhatsApp"

1. **Build the PDF on the phone** with `expo-print` (`printToFileAsync`), from an HTML receipt
   built out of the receipt response. Every word on it is the server's: association header,
   receipt number, payer name and line as issued, purpose label, amount, amount in words,
   balance due, mode, collected by, treasurer. User-entered text (names, notes) is HTML-escaped.
   Times are shown in IST, as on screen.
2. Copy it to the cache as `<receipt number>.pdf` (`DPB-2026-27-0004.pdf`), so the file name in
   the chat is the receipt number. Earlier receipt PDFs in that folder are removed first, so at
   most one is ever left on the phone.
3. **Hand the PDF to WhatsApp** using `react-native-share` (`shareSingle`, `social: WHATSAPP`,
   `type: application/pdf`). ~~Opened at the member's chat via `whatsAppNumber`~~ — see
   *Found on the phone* below: for now WhatsApp opens its "Send to…" picker with the PDF
   attached, and the collector picks the member and taps Send.

While this runs the button shows a spinner; a failure (WhatsApp not installed, etc.) shows the
usual error banner.

## Unchanged

- A **cancelled** receipt still sends the server's cancellation notice as text (`wa.me`) — it
  is a notice, not a receipt.
- A payer with **no number** still gets no WhatsApp action.
- The on-screen receipt itself.

## Dependencies — needs a new Android build

| Package | Version | Why |
|---|---|---|
| `expo-print` | `~15.0.8` (via `npx expo install`) | HTML → PDF using Android's own WebView print engine — nothing bundled |
| `react-native-share` | `12.3.1` (via `npx expo install`) | `shareSingle` to WhatsApp with a target number |
| `expo-build-properties` | `~1.0.10` (via `npx expo install`) | **Added during the build, not in the original plan.** `react-native-share`'s config plugin `require`s it and fails to load without it. Build-time only — no code ships in the app — and not listed under `plugins`, since only the share plugin uses it |

`react-native-share`'s config plugin in `app.json` adds
`<queries><package android:name="com.whatsapp"/></queries>` — Android 11+ hides other apps
from ours without it. `android/` is generated, so this must go through `app.json`, not a
hand-edited manifest.

Both are native modules: **the dev build on the phone must be rebuilt**, and the release build
later. Because the WhatsApp `<queries>` entry comes from a config plugin, apply it to the
generated `android/` first:

```bash
npx expo prebuild --platform android      # not --clean: it would regenerate android/ from scratch
EXPO_PUBLIC_API_BASE_URL=http://<mac-ip>:8080/api/v1 npx expo run:android --device
```

## Files

| File | Change |
|---|---|
| `src/features/money/receiptPdf.ts` *(new)* | `receiptHtml(receipt)` and `sendReceiptPdf(receipt)` |
| `src/features/money/ReceiptScreen.tsx` | the Send button uses `sendReceiptPdf` on Android; busy state + error banner |
| `app.json` | `react-native-share` plugin with `com.whatsapp` |
| `package.json` | the two dependencies |

## Tests

- `receiptHtml` carries the server's strings, escapes user text, shows the balance line only
  when due, and marks nothing it shouldn't.
- `sendReceiptPdf` prints, names the file after the receipt number, clears the old ones, and
  calls `shareSingle` with `91` + the WhatsApp number and `application/pdf` (libraries mocked).
- The receipt screen sends the PDF for a live receipt and keeps the text notice for a cancelled one.

## Found on the phone (2026-10-04)

With `whatsAppNumber`, WhatsApp opened the member's chat **without the PDF**. The library
launches WhatsApp twice when given a number — the conversation first, then 10 ms later the
share intent carrying the file — and on current Android the second launch, made from the
background, is dropped. (Inferred from the library's source; there was no device log to read.)

**Step 1, done:** no number is passed, so WhatsApp gets one launch carrying the PDF and opens
its picker. JS-only — works on the existing dev build after a reload.

**Step 2:** a small single-intent native module of our own — see *Step 2 — plan* below.

## Step 2 — one launch, PDF and number together

> **Status:** implemented 2026-10-04. 222 tests green; the module compiles
> (`:whatsapp-share:compileDebugKotlin`) and the merged debug manifest carries the
> `com.whatsapp` query. Verified on an Android phone the same day.

Why the libraries can't just do this: Android's share mechanism has no "recipient" — it hands a
file to an app. WhatsApp's [official Android integration](https://whatsapp.com/faq/android/28000012)
is "share to WhatsApp" (no recipient) and click-to-chat links (a recipient, text only). Picking
the chat uses the undocumented `jid` extra, which per developer reports opens the chat
directly **only when the number is in the phone's contacts** — otherwise WhatsApp shows its
picker. `react-native-share` launches twice to get round that, and Android 10+'s
[background-launch rules](https://developer.android.com/guide/components/activities/background-starts)
drop the second launch.

**Design**

- A local Expo module, `modules/whatsapp-share` (Android only), with one function:
  `sharePdf(contentUri, phone)`. It starts a single `ACTION_SEND` from the current activity —
  in the foreground, so no background-launch rule applies — with `setPackage("com.whatsapp")`,
  `type application/pdf`, `EXTRA_STREAM` + `ClipData` for the file,
  `FLAG_GRANT_READ_URI_PERMISSION`, and `jid = <91XXXXXXXXXX>@s.whatsapp.net`.
- The file link is `expo-file-system`'s own `File.contentUri` (its FileProvider already
  covers the cache folder) — no FileProvider of ours.
- The module's own manifest declares `<queries><package android:name="com.whatsapp"/></queries>`;
  library manifests merge into the app's, so no config plugin is needed.
- JS loads it with `requireOptionalNativeModule`: a build without the module shows "update the
  app" on Send instead of crashing at start — the ExpoPrint crash on 2026-10-04 is why.
- `react-native-share` and `expo-build-properties` are removed, with the plugin entry in
  `app.json`.

| Member's number | Result |
|---|---|
| Saved in the collector's contacts | Their chat opens with the PDF attached — tap Send |
| Not saved | WhatsApp's picker, with the PDF attached |
| WhatsApp not installed | "WhatsApp is not installed on this phone." on the receipt screen |

Never an empty chat: the number and the file travel in the same launch. WhatsApp Business-only
phones are not handled (`com.whatsapp.w4b`) — a two-line addition if wanted.

Needs a new build (native module added, one removed).

## Known limits

- Until step 2, the collector picks the member in WhatsApp's picker. Step 2's direct chat
  will rely on WhatsApp honouring the undocumented `jid` intent extra.
- The receipt goes from the **collector's own WhatsApp**, not an association number.
- Only WhatsApp (`com.whatsapp`) is targeted; a phone with only WhatsApp Business installed would
  need `com.whatsapp.w4b` added — not in this change.
- As noted in the API's Phase 1 doc, the header (treasurer) and "collected by" name are read
  live, so a reprint of an old receipt shows today's values for those two.
