# FE hand-off — Aadhaar is now a generic **ID proof**

**Backend change, shipped on `feature/IdProof_Refactor`.** This is a **breaking** change:
every call that creates a member changes shape, and the Aadhaar image endpoints move to a
new path. Nothing else in the register moved.

**Why:** the register used to accept exactly one document, Aadhaar, and `aadhaar_front_key`
was mandatory — so a shopkeeper unwilling to hand over Aadhaar could not be enrolled at all.
A member may now present any one of five officially-valid documents. Aadhaar remains on the
list; it is simply no longer the only option.

---

## 1. The five accepted types

```
AADHAAR | DRIVING_LICENSE | PASSPORT | VOTER_ID | PAN
```

`idProofType` is **required** on every member-create call. The picker should appear before
image capture, since it determines what the collector is photographing.

---

## 2. `NewPersonRequest` changed — this hits **four** endpoints

The member payload is nested in four different request bodies. All four break together:

| Endpoint | Where the member payload sits |
|---|---|
| `POST /api/v1/people` | `person` |
| `POST /api/v1/shops` | `owner.newPerson` |
| `POST /api/v1/shops/{id}/links` | `newPerson` |
| `POST /api/v1/shops/{id}/transfer` | `newPerson` |

| Was | Now |
|---|---|
| — | `idProofType` **(new, required)** |
| `aadhaarFrontKey` *(required)* | `idProofFrontKey` *(required)* |
| `aadhaarBackKey` *(optional)* | `idProofBackKey` *(optional)* |
| `aadhaarLast4` *(optional)* | `idProofLast4` *(optional)* |

```json
{ "person": { "name": "…", "phone": "9820000000", "whatsappPhone": "9820000000",
              "address": "…", "photoKey": "<key>",
              "idProofType": "PASSPORT",
              "idProofFrontKey": "<key>", "idProofBackKey": "<key?>",
              "idProofLast4": "4567?", "consent": true },
  "links": [ { "shopId": "<uuid>", "role": "STAFF" } ] }
```

**`idProofLast4` now accepts letters.** The rule relaxed from four digits to four
alphanumerics, because a PAN's last four characters include one (`ABCDE1234F` → `234F`).
Loosen any client-side `\d{4}` check to `[A-Za-z0-9]{4}` or valid PANs will be rejected
before they reach us.

---

## 3. `POST /api/v1/media/upload-url` — the `type` values changed

| Was | Now |
|---|---|
| `AADHAAR_FRONT` | `ID_PROOF_FRONT` |
| `AADHAAR_BACK` | `ID_PROOF_BACK` |
| `PHOTO` | `PHOTO` *(unchanged)* |

The returned keys now live under `id-proofs/` instead of `aadhaar/`. Treat keys as opaque —
never parse or construct them.

---

## 4. Viewing and replacing — new paths

| Method & path | Roles | Notes |
|---|---|---|
| `GET /people/{id}/id-proof/{side}` | **admin** | was `/aadhaar/{side}`. Signed URL, every view logged |
| `PUT /people/{id}/id-proof` | admin, collector | **NEW** — full replace, the only way to change type |
| `PUT /people/{id}/id-proof/{side}` | admin, collector | side re-capture; type untouched |

`AadhaarUpdateRequest { side, key }` is **gone**, replaced by two shapes:

```jsonc
// Full replace — swapping the document, e.g. Aadhaar -> Passport.
// Omitting backKey clears the stored back side.
PUT /people/{id}/id-proof
{ "type": "PASSPORT", "frontKey": "<key>", "backKey": "<key?>", "last4": "4567?" }

// Re-capture one side within the current type — a blurry shot, or adding a back page.
PUT /people/{id}/id-proof/{FRONT|BACK}
{ "key": "<key>" }
```

Both return **204**. Pick full replace when the user changes the *document*; pick side
re-capture when they are re-shooting an image of the same one. Side re-capture cannot change
the type — that is deliberate, so a front and back can never come from two different
documents.

---

## 5. `GET /people/{id}` — profile fields

| Was | Now |
|---|---|
| `aadhaarLast4` | `idProofType` + `idProofLast4` |

```
PersonProfile { id, name, phone, whatsappPhone, address,
                idProofType, idProofLast4, consent,
                addedByName, addedOn, photoUrl, shops[] }
```

Show the document type beside the masked number — "Passport ••••4567" rather than a bare
"••••4567", since it is no longer safe to assume Aadhaar.

---

## 6. Error codes

| Was | Now | When |
|---|---|---|
| `aadhaar_missing` | `id_proof_missing` | 404, that side is not on file |
| `invalid_media_key` | *(same code)* | message text now says `ID_PROOF_FRONT`, not `AADHAAR_FRONT` — do not match on message text |
| — | `validation_error` | **now also** returned for an unknown enum value (e.g. a misspelled `idProofType`, or a bad `{side}` in the path). Previously these escaped the standard `{code, message}` envelope |

---

## 7. Copy to update

The access rule is unchanged, only the wording: **a collector captures the ID proof but can
never view it again; only an admin can open a stored image, and every view is logged.** Any
screen that says "Aadhaar" in that sentence should now say "ID proof", and the blurred
placeholder for non-admins reads "ID proof is visible to the admin only".

The member photo is unaffected — still viewable by anyone signed in.
