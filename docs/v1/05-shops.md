# Phase 5 — Shops

**Goal:** the full shop register — list with server-side search and pagination, detail,
registration with either kind of licence holder, edit, renter/staff links, licence transfer and
soft delete. Plus the duplicate guard that every "add a person" flow goes through.

---

## 1. What was decided

| Topic | Decision |
|---|---|
| `MemberForm` | A **component, not a screen.** Registration renders it inline as the design's "step 2 of 2" and embeds the result in `POST /shops`. |
| Add-person / transfer | **Modal screens, not bottom sheets.** Their create-new branch renders a member form with two image captures. |
| Search sheet | Offers "create new" as soon as a search has been made, not only on zero results. |
| Register action | **Sticky** at the bottom of the list, not the last row. |
| Lane chips | Derived from loaded pages. There is no lanes endpoint and never will be. |
| `tillDate` on transfer | Left to the server, which defaults to today. |
| Count line | From `totalElements`, never the loaded row count. |

---

## 2. Files

```
features/shops/
├── hooks.ts                    infinite list, detail, 6 mutations
├── ShopsListScreen.tsx         search · lane chips · count · FlatList pagination
├── ShopDetailScreen.tsx        header · people · edit · transfer · delete · unlink
├── ShopFormScreen.tsx          register (2 steps) and edit
├── ShopAddPersonScreen.tsx     link a renter or worker
├── ShopTransferScreen.tsx      replace the licence holder
└── components/ShopCard.tsx

components/search/PersonSearchSheet.tsx     the duplicate guard — used by 4 flows
features/people/MemberForm.tsx              pulled forward from phase 6
components/ui/CheckRow.tsx
```

---

## 3. `hooks.ts`

`useShopsList(filters)` is an `useInfiniteQuery`:

```ts
initialPageParam: 0
getNextPageParam: (last) => last.page + 1 < last.totalPages ? last.page + 1 : undefined
```

`page` is 0-based, so the last page is `totalPages - 1`.

Mutations: `useRegisterShop` `useUpdateShop` `useDeleteShop` `useAddShopLink`
`useTransferLicence` `useRemoveLink`.

All six share `useShopInvalidation`, which invalidates `shops.all`, the touched
`shops.detail(id)`, **and `people.all`** — a link change alters a person's shop list, and
registering an owner can create a person outright.

---

## 4. The duplicate guard — `PersonSearchSheet`

Both "+ Add person to this shop" and "+ Add a member" open this, never a blank form
(integration doc §5.7, spec §7.3). At ~2,300 people it is the difference between one profile per
worker and two half-profiles with split histories. Before this phase, both buttons were
`onPress={() => {}}`.

- **Nothing is listed until the user types.** Listing everyone would defeat the point and pull
  the register onto the phone.
- Rows show name, phone **and existing shops with roles** — that last part is what tells a
  collector "this is the right man".
- `excludeIds` hides people who can't be picked (already linked here, or the current owner on a
  transfer).
- Results are the first page only. Refine the search rather than paginating inside a sheet.
- The term clears when the sheet closes, so reopening doesn't reuse a stale search.

**Deviation from the design:** it offers "Not on record — create new" as soon as a search has
been made, not only when there are zero results. Searching "Ramesh" and getting three of them
who are all the wrong Ramesh is a real case, and the user has still been made to look first. The
button is primary when there are no matches and secondary when there are.

Four call sites: registration's owner picker, add-person-to-shop, transfer, and the standalone
add-member screen.

---

## 5. `MemberForm` — why it's a component

Shop registration's new-owner branch must embed its payload in `POST /shops`:

```json
{ "shopNumber": "A-31", …, "owner": { "newPerson": { …member fields… } } }
```

It must **not** call `POST /people` — that would create the person separately and lose the
atomic shop + OWNER link the API guarantees, leaving a window where the person is shopless (api
slice 3 explicitly builds `PersonCreationService` to avoid exactly that).

So `MemberForm` takes `onSubmit(payload: NewPersonPayload)` and lets the caller decide what to
do with it. Rendering it inline beats threading a callback through navigation params, and it
matches the design's "step 2 of 2".

Fields in spec §7.2 order: name → photo → *[links]* → phone → WhatsApp (same-as toggle) →
address → Aadhaar front/back + optional last 4 → consent → "Captured by … · date".

Validation in spec §7.2's *different* order, one message at a time:
**name → phone → links → photo → Aadhaar front → consent.**

Field order and validation order genuinely differ in the spec; both are honoured. The
`linksSection` / `validateLinks` props (added in [phase 6](06-people.md)) are how a standalone
add slots its shop-links builder into both sequences.

Submit is **disabled while any image is still uploading** — without its key the member would be
saved without the mandatory photo or Aadhaar.

A live duplicate-phone warning queries `GET /people?query=<phone>` on a 400ms debounce, so the
collector learns before capturing a photo and an Aadhaar (spec §7.2).

---

## 6. Screens

### `ShopsListScreen`

`FlatList` with `onEndReached` (threshold 0.4), search debounced 350ms, lane chips, count line
from `totalElements`. Distinct empty / error / offline states — **no mock fallback**.

Lane chips are derived from lanes seen in loaded pages and grow as you scroll. api slice 1: "No
wings, no floors, no managed lane list" — `lane` is free-text `varchar(120)` filtered by
`lower(lane)`. Adding `GET /shops/lanes` to the API would let the chips be complete from the
first page; today they can only reflect what's loaded.

The register button is a **sticky bottom bar**. The design says "at the bottom of the list", but
at 1,000 shops nobody scrolls to the end.

### `ShopDetailScreen`

Header (number, business, lane, tenancy chip), the "Previously: … · licence held till …" line
when `formerHolderName` is set, people at the shop ordered OWNER → RENTER → STAFF, and
role-gated actions. The fee card and "Earlier years" from the design are v2 and omitted.

Per-row **Remove** appears only for an admin **and only on non-OWNER links** — the licence
changes through transfer, never removal.

Both confirm sheets state the consequence: deleting names how many people get unlinked and notes
the number frees up; unlinking warns when it's the person's only shop.

### `ShopFormScreen`

One screen, two modes, and for registration two steps:

```
step "shop"   shopNumber · businessName · lane · tenancy chips
              then: Choose licence holder → PersonSearchSheet
                      pick existing → submit POST /shops { owner: { existingPersonId } }
                      create new    → step "owner"
step "owner"  MemberForm → submit POST /shops { owner: { newPerson } }
```

Editing shows only the shop card and `PATCH`es **all four fields**, per §5.3.

`409 duplicate_shop_number` becomes an **inline field error** on the shop number, not a banner —
and if it arrives during step 2 it returns to step 1 so the field is visible.

### `ShopAddPersonScreen`

Role chips (RENTER / STAFF only), then the search sheet, then either `existingPersonId` or an
inline `newPerson`. The API's `AddLinkRequest` accepts both.

When the shop already has a renter, a notice appears **before** the attempt — the server still
answers `409 renter_exists`, but earning an error you could have predicted is poor.

### `ShopTransferScreen`

Admin only. States the consequences before confirming, as §5.5 requires: the current holder is
replaced and stamped as former holder with today's date, and **everything they contributed stays
on their own profile** — those were their payments.

The current owner is excluded from the picker (the API answers `400 already_owner`).

`tillDate` is omitted so the server defaults to today. A date picker for backdating is worth
adding only if the committee asks.

---

## 7. Verification

28 assertions against a live API, driving the real `src/api` modules. Every invariant from
integration doc §9 that shops can touch:

```
register with existing owner        exactly one OWNER link
duplicate number, different case →  409 duplicate_shop_number
search by number / by person name   hits
lane filter                         honoured
pagination maths                    size 2 → 4 pages of 7
second renter →                     409 renter_exists
same person twice at one shop →     409 already_linked
OWNER via add-link →                400 owner_not_addable
remove OWNER link →                 400 owner_not_removable
people ordered OWNER/RENTER/STAFF   yes
edit sends all four fields          applied
transfer                            new holder in; former holder + date stamped;
                                    still exactly one owner
transfer to the current holder →    400 already_owner
register with inline newPerson      shop + owner atomic, real uploaded images,
                                    photoUrl served back, whatsapp defaulted
delete → detail                     404 shop_not_found
soft delete                         freed the number for reuse
```

The harness cleans up after itself.

---

## 8. Notes

1. **`consent: false` returns `400 validation_error`, not `consent_required`.** Bean validation
   on the DTO catches it first. Both block the write, and `MemberForm` validates consent
   locally, so nothing changed — but don't branch on `consent_required` for this path.
2. **Don't spread into `OwnerInput`.** `{ role, ...body }` where `body` is the union won't
   narrow, and casting it hides real errors. Build the literal at the call site.
3. **A shop always has exactly one owner** (api slice 1, overriding the spec's "temporarily no
   owner"). `licenceHolderName` is still typed `| null` and rendered defensively, but there is
   no "add the licence holder" flow to build.
4. **Transfer has a flush-ordering trap on the server** (api slice 3 §6): it soft-removes the
   old owner then inserts the new one, and Hibernate flushes inserts before updates, which the
   one-owner partial index rejects. Fixed there with an explicit flush. Nothing for the client
   to do, but it explains why transfer is a single atomic endpoint rather than two calls.
