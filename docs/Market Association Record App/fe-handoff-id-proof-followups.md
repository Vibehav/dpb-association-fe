# FE hand-off — changing a document type is now admin-only, plus an access-log screen

**Backend change, shipped on `feature/IdProof_Refactor`.** Smaller than the previous
ID-proof hand-off: **no request or response payload you already send has changed**. One
existing call can now return 403 where it used to succeed, and there is one new admin screen
worth building.

Read [`fe-handoff-id-proof.md`](fe-handoff-id-proof.md) first if you have not migrated to the
generic ID proof yet — that one is the breaking change; this one sits on top of it.

---

## 1. `PUT /people/{id}/id-proof` is admin-only — collectors now get 403

The full-replace call is the only way to change **which document** is on file. That is now an
admin act.

| Endpoint | Was | Now |
|---|---|---|
| `PUT /people/{id}/id-proof` | admin, collector | **admin only** |
| `PUT /people/{id}/id-proof/{side}` | admin, collector | *unchanged* |
| `POST /people` (and the three nested variants) | admin, collector | *unchanged* |

**Why the split.** The functional spec (§4.3) scopes a collector to *"re-capture if the copy
is unclear"* — that is the `/{side}` call, and it still works for them. Swapping a passport
for a PAN card is a different act: it changes what the register asserts about a member's
identity, so it belongs with transfers and deletions.

**A collector can still replace both images.** Two `/{side}` calls, one per side. What they
cannot do is move the `type`. So "re-shoot this member's ID proof" remains a collector flow;
only "this member has a *different* document now" is gated.

### What the UI has to do

On the member profile, a collector should see **"Re-take image"** but not **"Change document
type"**. If a collector does reach the replace call, the response is:

```json
{ "code": "forbidden", "message": "You do not have permission for this action" }
```

Show something actionable — *"Ask an admin to change the document type"* — not the raw
message. A collector standing in front of a member who has produced a new passport needs to
know the next step is escalation, not that they did something wrong.

> The edit sheet's document-type picker should therefore be **read-only for collectors**, with
> the admin-only hint beneath it. Enabling it and failing on submit is a worse experience than
> not offering it.

---

## 2. New: `GET /people/{id}/id-proof/log` — admin only

Who has viewed or re-captured this member's ID proof, newest first.

```jsonc
GET /api/v1/people/{id}/id-proof/log        // admin only; 403 for collector/viewer

[
  { "action": "RECAPTURE", "side": null,    "idProofType": "PAN",
    "previousIdProofType": "PASSPORT",      "actorName": "Ishwar",
    "accessedAt": "2026-09-16T17:12:04.918Z" },
  { "action": "VIEW",      "side": "FRONT", "idProofType": "PASSPORT",
    "previousIdProofType": null,            "actorName": "Nitin More",
    "accessedAt": "2026-09-16T17:10:33.339Z" }
]
```

| Field | Notes |
|---|---|
| `action` | `VIEW` or `RECAPTURE` |
| `side` | `FRONT` / `BACK`, or **`null`** meaning the whole document was replaced |
| `idProofType` | the type **after** this action |
| `previousIdProofType` | the type **before** it — `null` unless a replace actually changed it |
| `actorName` | the committee member who did it; still populated after they leave the committee |
| `accessedAt` | UTC instant, render in IST |

**Rendering suggestions.** A row reads naturally as one sentence:

```
Nitin More viewed the front          · 16 Sep, 10:40 PM
Ishwar replaced the document          · 16 Sep, 10:42 PM
        Passport → PAN
```

Use `previousIdProofType` being non-null as the signal to render that second line — it is the
only place a document swap is visible. `side: null` means "whole document", so don't print
"replaced the null side".

**Where to put it.** A "View access history" action on the ID-proof card of the member
profile, admin-only, opening a simple list. There is no pagination — a single member's log is
small — and reading it does **not** itself create a log entry, so opening the screen is free.

---

## 3. Roles matrix — two rows to add

| Capability | Admin | Collector | Viewer |
|---|:--:|:--:|:--:|
| Re-take an ID-proof image (same document) | ✅ | ✅ | — |
| **Change which document is on file** | ✅ | — | — |
| **Read the ID-proof access log** | ✅ | — | — |

---

## 4. Nothing else moved

To be explicit, because this is the part that saves you a regression hunt:

- `POST /people`, `POST /shops`, `POST /shops/{id}/links`, `POST /shops/{id}/transfer` — the
  member payload is **unchanged**, `idProofType` included.
- `POST /media/upload-url` and the presigned-PUT flow — unchanged.
- `GET /people/{id}` — unchanged, still returns `idProofType` + `idProofLast4`.
- `GET /people/{id}/id-proof/{side}` — unchanged, still admin-only and still logged.
- `PUT /people/{id}/photo` — unchanged.
- Error codes — no renames; `forbidden` on the newly gated call is the existing shape.

`POST /media/reconcile` and `POST /media/orphans/sweep` also exist and are admin-only, but
they are **operations endpoints** for reclaiming storage. There is no reason to surface them
in the member-facing app; skip them unless you are building an admin maintenance screen.

---

## 5. Carried over from the add-member form discussion

Not a backend change, recorded here so it does not get lost — when the collector changes the
document type **on the add-member form**, clear any already-captured images and the last-4:

- Only prompt if something has actually been captured; before the first capture, switching
  type should be free and silent.
- Clear `idProofLast4` along with the images — an Aadhaar's last-4 is meaningless on a
  passport, and the field's hint changes with the type.
- Don't try to clean up the already-uploaded object. It becomes an unreferenced file, which
  the backend now reclaims on its own schedule.

Copy for the dialog: *"Change document type? The captured images and last-4 will be cleared
and must be re-taken."*

The backend cannot check that an image matches the declared type — it is a JPEG — so this is
the only place a passport gets prevented from being filed as an Aadhaar.
