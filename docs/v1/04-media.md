# Phase 4 — Media

**Goal:** turn a camera tap into a storage key. Compress, presign, `PUT` straight to
S3/MinIO, hand back the opaque key that goes into a person payload.

Built **before** the People screens, out of plan order, because the member form cannot submit
without it — `photoKey` and `aadhaarFrontKey` are mandatory on every new person, including a
shop's inline licence holder.

---

## 1. What was decided

| Topic | Decision |
|---|---|
| Upload path | Presigned `PUT` direct to storage. The API never sees image bytes (integration doc §6, api slice 4). |
| Compression | Resize the **longer** edge to 1600px, JPEG quality 0.7, one lossy pass. |
| When to presign | **Inside the upload call**, never at form-open — the URL lives 300s. |
| Retry | Exactly one, and only on a 403 from storage. |
| EXIF | Stripped (`exif: false`) — no GPS coordinates travelling beside a scan of someone's Aadhaar. |
| Failure semantics | A failed upload keeps the preview and yields **no key**, so a form cannot look complete when the image never landed. |
| Temp files | Deleted in a `finally`. |

---

## 2. Two corrections to the plan's API choices

SDK 54 moved a lot here. Both of the plan's original choices were checked against the installed
packages and were wrong:

| Plan said | Reality | Used instead |
|---|---|---|
| `expo-file-system`'s `uploadAsync` with `FileSystemUploadType.BINARY_CONTENT` | Only exists under **`expo-file-system/legacy`**. The root export is the new File/Directory API. | `new File(uri)` — the class **`implements Blob`** — passed as a body |
| plain `fetch` for the `PUT` | RN's `fetch` tests `instanceof` against **its own** Blob implementation, so a native Expo `File` would not be recognised and would be stringified | **`fetch` from `expo/fetch`**, which accepts a Blob body and streams it from disk |

`manipulateAsync` *is* still exported from the `expo-image-manipulator` root (alongside the
newer context API), so no legacy import there either.

Net result: **no legacy imports anywhere in the media pipeline.**

`expo/fetch` resolves via `expo/fetch.js` at the package root — the `expo` package has no
`exports` map, so subpath resolution falls back to the filesystem.

---

## 3. `src/media/upload.ts`

```ts
uploadImage(type: MediaType, image: { uri, width?, height? }): Promise<string /* key */>
```

```
compress(image)                        manipulateAsync → cache file, JPEG q0.7
  ↓
new File(compressed.uri)               implements Blob
  ↓
for attempt in 0..1:
    mediaApi.uploadUrl(type)           presigned LATE — ttl 300s
    expoFetch(uploadUrl, PUT, body: file, Content-Type: image/jpeg)
    ok           → return key
    status ≠ 403 → break               only an expired signature is recoverable
  ↓
throw ApiError(status, "upload_failed", …)
finally: file.delete()
```

### Resize logic

```ts
if (!width || !height) return [];                        // don't guess — would upscale
if (Math.max(width, height) <= MAX_EDGE) return [];      // already small enough
return width >= height ? [{ resize: { width: MAX_EDGE } }]
                       : [{ resize: { height: MAX_EDGE } }];
```

Constraining the *long* edge is the point. Resizing blindly by width leaves a portrait Aadhaar
photo 4,000px tall. Dimensions come from `ImagePickerAsset`, which always provides them; the
unknown branch is a safety net that compresses without resizing rather than upscaling.

### Why no `Authorization` header on the `PUT`

The URL carries its own signature. An extra auth header makes some S3 configurations reject the
request outright. This is easy to "helpfully" add back — don't.

### Why the temp file is safe to delete

`manipulateAsync` **always** writes a new file into the cache directory, even with an empty
action list, because it re-encodes. So the deleted path is never the picker's own asset. Without
this, every capture leaks a multi-megabyte scratch file.

---

## 4. `src/media/useImageCapture.ts`

One capture slot as a state machine:

```
empty → choosing → uploading → ready { previewUri, key }
                            ↘ failed { previewUri, message }   → retry()
```

```ts
const photo = useImageCapture("PHOTO");
photo.state · photo.key · photo.previewUri · photo.busy
photo.captureFromCamera() · photo.pickFromLibrary() · photo.retry() · photo.clear()
```

- `retry()` re-uploads the asset already captured. It does **not** reopen the camera.
- Cancelling the picker restores the previous state, so backing out of a retake leaves an
  existing image alone. That's why `stateRef` mirrors `state`.
- A `mountedRef` guard means an upload outliving its sheet doesn't `setState` after unmount.
- `key` is only non-null in the `ready` state. That single fact is what stops a half-uploaded
  form from submitting.

### Picker options

```ts
mediaTypes: ["images"]   // the array form; MediaTypeOptions is deprecated
quality: 1               // upload.ts does the single lossy pass
base64: false            // never pull multi-MB bytes into JS
exif: false              // no GPS beside an Aadhaar scan
// PHOTO only:
allowsEditing: true, aspect: [1, 1]    // a face, shown as a circle
// AADHAAR_*: no crop — the whole card must be captured
```

---

## 5. `ImageCaptureField` — `src/components/media/`

The slot UI: label, preview (square for `PHOTO`, ~ID-card ratio for Aadhaar), upload overlay,
green tick when ready, failure message with **Retry upload**, and Camera / Choose / Remove.

The states are deliberately distinct. A failure shows the preview *plus* a retry, because the
image exists locally but the key does not — and submitting would silently drop it.

---

## 6. Dev harness — `src/features/dev/MediaCheckScreen.tsx`

Reachable from Account under `__DEV__` only, registered conditionally in `AppStack`.

Proves the full round trip on a real device: capture → compress → presigned `PUT` → key →
attach to a person → signed `GET` → render the bytes back. It writes to whichever person
`GET /people?size=1` returns first, i.e. dev seed data.

**Delete `src/features/dev/` and its two registrations once the member form has been exercised
on device.** It is scaffolding, not a feature.

---

## 7. Verification

Server-side chain, byte-for-byte:

```
presign PHOTO                → key photos/f25c8831…   ttl 300s
PUT to storage (no auth)     → HTTP 200, 50,077 bytes
PUT /people/{id}/photo {key} → 204
GET /people/{id}/photo       → signed url, ttl 300s
download                     → HTTP 200, 50,077 bytes
sha256 up == sha256 down     → PASS
GET /people/{id}             → photoUrl served inline
```

On real hardware: `aadhaar_access_log` showed three `RECAPTURE` → `VIEW` pairs milliseconds
apart — the harness's save-then-read-back. Attached objects measured **89,274 bytes** (photo)
and **104,165 bytes** (Aadhaar front), both `image/jpeg`, which is the expected range for
1600px at q0.7 from a phone camera. Compression works.

That device run is what proved the RN-only parts: `manipulateAsync`, `expo/fetch` with a `File`
body, the picker, and permissions.

---

## 8. Gotchas

1. **`S3_ENDPOINT` must be the LAN address for device testing.** Presigned URLs are generated
   from `app.s3.endpoint`, which defaults to `http://localhost:9000` — meaning *the phone*.
   Every upload and every photo load fails on device while working perfectly on the laptop.
   Start the API with `S3_ENDPOINT=http://<mac-lan-ip>:9000`. MinIO already publishes on
   `0.0.0.0:9000`, so no container change is needed. A separate public-endpoint property on the
   API would be worth having, so the signer and the internal client can differ.
2. **Orphaned objects.** Every re-capture leaves the previous object in the bucket, and an
   abandoned form orphans whatever it uploaded — images are uploaded *before* the record is
   created. Three captures produced three objects with only the newest attached. The API docs
   already note this (slice 4 §7, cleanup cron deferred). The orphaned **Aadhaar** objects are
   the sensitive ones: unreferenced but still stored. Worth a reaper keyed on "no row
   references this key".
3. **MinIO inlines small objects into `xl.meta`**, so `du` on an object directory reflects the
   data. A `du` floor of 8 KB is not evidence of an empty upload; check the actual
   `Content-Length` through a signed `GET`.
4. **The presigned `PUT` has no size or content-type enforcement** (api slice 4 §7). The client
   is the only thing keeping uploads small — which is the whole reason compression happens
   before the presign, not after.
