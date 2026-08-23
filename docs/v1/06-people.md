# Phase 6 — People

**Goal:** the member register — list with role filters, the profile screen, photo retake, shop
links, edit, standalone add, and the Aadhaar panel with its admin-only viewing rule.

Lighter than planned, because `MemberForm` and `PersonSearchSheet` were already built in
[phase 5](05-shops.md).

---

## 1. What was decided

| Topic | Decision |
|---|---|
| Aadhaar for non-admins | An explicit **locked placeholder**, and the endpoint is **not called at all**. |
| Aadhaar URL caching | `gcTime` shorter than the URL's 5-minute life, so a dead URL is never handed to an `<Image>`. |
| Re-capture / retake | Attach on key arrival — one action, not capture-then-save. |
| Shop picker | A sheet that includes the role chips, so linking is one interaction. |
| Standalone add | Opens **on the search sheet**; the form is only reachable via "not on record". |
| Money fields | Omitted. Lifetime given, last contribution, Collect and contribution history are all v2. |

---

## 2. Files

```
features/people/
├── hooks.ts                        infinite list, detail, 7 mutations, the Aadhaar query
├── PeopleListScreen.tsx            search · role chips · count · pagination
├── PersonProfileScreen.tsx         header · photo · links · details · Aadhaar · delete
├── PersonEditScreen.tsx            PATCH name / phone / whatsapp / address
├── AddMemberScreen.tsx             search-first standalone add
├── MemberForm.tsx                  (phase 5) + linksSection / validateLinks
└── components/
    ├── PersonRow.tsx
    ├── MemberPhoto.tsx
    └── AadhaarPanel.tsx

components/search/ShopSearchSheet.tsx     shop + role picker, RENTER/STAFF only
```

---

## 3. The Aadhaar panel

The strictest rule in the app (integration doc §9, spec §4.3). Worth reading the component
before changing anything near it.

| Role | View a stored image | Re-capture |
|---|---|---|
| Admin | Yes — **every view writes a `VIEW` row** to `aadhaar_access_log` | Yes |
| Collector | **No.** The endpoint is not called | Yes (writes a `RECAPTURE` row) |
| Viewer | No | No |

Implementation:

- `useAadhaarUrl(id, side, enabled)` is enabled **only** for `isAdmin && revealed`. Never
  prefetched, never fired on mount. `retry: false`, and `staleTime`/`gcTime` are both 4 minutes
  — under the URL's 300s life.
- Non-admins get a lock-icon placeholder. The design shows a *blurred* image; since the bytes
  are never fetched there is nothing to blur, so an explicit locked frame carries the same
  intent more honestly.
- `404 aadhaar_missing` is handled distinctly: "The back was never captured." The profile
  response carries no flag for whether a side exists, so the 404 *is* the signal.
- `aadhaarLast4` and "Captured by X · date" are shown to everyone. The API has no separate
  capturer field — it reuses the member's added-by / added-on (api slice 4 §1).
- Each side is its own `SideCard` component, so each owns its own URL query and capture slot
  rather than juggling two of each.

**Do not "optimise" this by prefetching, or by fetching and handling the 403.** Both defeat the
feature. Every admin view is an audited event.

---

## 4. `hooks.ts`

`usePeopleList` mirrors the shops infinite query. `usePerson` is a plain query.

Mutations: `useCreatePerson` `useUpdatePerson` `useAddPersonLink` `useDeletePerson`
`useUpdatePhoto` `useUpdateAadhaar`.

`usePersonInvalidation` invalidates `people.all`, the touched `people.detail(id)` **and
`shops.all`** — a link change alters the shop's people list too.

`useUpdateAadhaar` additionally **removes** the signed-URL query for the side it replaced, so a
stale URL for the old object can't be served.

---

## 5. Screens

### `PeopleListScreen`

Search (name, phone or shop number) debounced 350ms; role chips `All | Owner | Renter | Staff`;
count line from `totalElements`; `FlatList` pagination.

`PersonRow` shows initials, name, phone, and a chip per shop-and-role. Lifetime given, last
contribution and the Collect action are v2 and absent; tapping the row opens the profile, which
is what the design's "History" action did.

The **"No shop linked"** state renders. It can't be *created* — every add needs ≥1 link — but
removing someone's last renter/staff link produces it, and so does soft-deleting their only shop
(api slice 3 §1, "Option A"). Integration doc §9 requires it to display.

### `PersonProfileScreen`

- Header: avatar, name, a "Renter at MK-2 · Staff at MK-5" summary, Edit for admin/collector.
- **Photo** via `MemberPhoto`: renders `photoUrl` from the profile response (already a signed
  URL, no extra call), retake for admin/collector, and shows the fresh local preview immediately
  so the UI doesn't wait for a refetch.
- **Shops & roles**: one row per link, tapping opens that shop. Remove for admins on non-OWNER
  links only. "Link another shop & role" opens `ShopSearchSheet`.
- **Details**: phone, WhatsApp, address, "Added on … by …", plus Call and WhatsApp device
  actions.
- **Aadhaar panel** (§3).
- Admin delete, with a confirm that spells out the unlinking and the freed phone number.

Contribution history and "Record a contribution" are v2 and omitted.

### `PersonEditScreen`

`PATCH /people/{id}` with name, phone, WhatsApp and address. `409 duplicate_phone` becomes an
inline field error. Photo and Aadhaar are replaced from the profile, not here — each is its own
capture-and-upload flow.

`whatsappPhone` is sent **explicitly** even when it equals the phone, so clearing a previously
separate number actually takes effect. (On *create* it is omitted so the server applies its
default.)

### `AddMemberScreen`

**Opens straight on the form.** It was originally built with a blocking search-first sheet, as
the prototype (`showPickSheet`) and spec §7.3 both specify — that was **removed as a product
decision** after being used on a device. The sheet made every add start with a search the
collector usually knows is unnecessary.

The duplicate guard is not gone, just quieter: `MemberForm` queries
`GET /people?query=<phone>` as the number is typed and warns inline before the collector
spends time on a photo and an Aadhaar capture. `409 duplicate_phone` remains the backstop.

To link someone already on record, open their profile → "Link another shop & role".
`PersonSearchSheet` still fronts the **shop-side** flows (`ShopAddPersonScreen`,
`ShopTransferScreen`), where finding an existing person is the point of the screen.

The links builder is passed into `MemberForm` as `linksSection`, with `validateLinks` wired into
the validation sequence. At least one link is mandatory and only RENTER/STAFF are offered —
there is deliberately no way to choose OWNER.

### `ShopSearchSheet`

Role chips **and** the shop search in one sheet, so linking is a single interaction. Excludes
already-linked shops. Same search-first behaviour as `PersonSearchSheet`: nothing listed until
the user types.

---

## 6. `MemberForm` gained two props

```ts
linksSection?: ReactNode          // rendered after the photo — spec §7.2 field order
validateLinks?: () => string | null  // checked after the phone — spec §7.2 validation order
```

The spec puts links after the photo when *laying out* fields and after the phone when
*validating* them. Both are honoured; that's why these are two separate props rather than one
slot.

Owner flows (registration, transfer) pass neither — their link is implied by the shop being
created or transferred.

---

## 7. Verification

26 assertions against a live API:

```
no links →                      400 validation_error
OWNER link on create →          400 owner_not_addable
OWNER from the person side →    400 owner_not_addable
created with a STAFF link       whatsapp defaulted, consent stored, photoUrl inline,
                                addedBy resolved to a real name
duplicate phone →               409 duplicate_phone   (on create and on edit)
search by phone / shop number   hits
OWNER and STAFF role filters    honoured
pagination maths                5 pages of 15
edit                            name, address, separate whatsapp
same shop twice →               409 already_linked
link removed                    back to one shop
photo retake                    readable after PUT, ttl 300s
admin opens Aadhaar front       ttl 300s, VIEW row written
back never captured →           404 aadhaar_missing
back readable after capture     yes
delete →                        404 person_not_found, phone reusable
```

Role gating — a collector's `PUT` allowed and `GET` refused on the same Aadhaar — is in
[08 §5](08-verification.md#5-role-gating).

---

## 8. Notes

1. **Pick a shop without a renter when writing tests.** A seeded shop may already have one, and
   `≤1 renter` means an unrelated assertion fails with `409 renter_exists`. This bit the first
   harness run.
2. **A harness that throws mid-run leaves test data behind.** One aborted run left a "Harness
   Member" in the register, found later by searching for the name. Clean up in a `finally`, or
   verify the register count afterwards.
3. **`MemberPhoto` and `AadhaarPanel` auto-attach on key arrival** via an effect keyed on
   `capture.key`, calling `capture.clear()` before the mutation so it can't re-fire. If you
   change that ordering, check it doesn't loop.
4. **The profile's `photoUrl` is already signed** — don't call `GET /people/{id}/photo` on
   mount. It exists for refreshing after a retake or once the embedded URL has expired.
