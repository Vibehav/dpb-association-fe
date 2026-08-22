# Design review — fixes after the first walkthrough

A pass comparing what was built against the **prototype** (`docs/Market Association Record
App/Market Association App.dc.html`) rather than the functional spec. The prototype is the
visual reference and it carries detail the spec doesn't; a few things had been built from the
spec and the integration doc alone, and drifted.

Also fixes one real bug found on device.

---

## 1. Home reloaded continuously (**bug, fixed**)

`useRefreshOnFocus` put its callback into the `useCallback` dependency array:

```ts
useFocusEffect(useCallback(() => { …refetch() }, [refetch]))   // ← wrong
```

`HomeScreen` passes an inline arrow, because it refetches two queries:

```ts
useRefreshOnFocus(() => { shops.refetch(); people.refetch() })
```

That arrow is a **new function on every render**, so: new callback → `useFocusEffect` tears down
and re-runs → refetch → state change → re-render → new callback → … The spinner never stopped.

Every other screen passes `query.refetch`, which React Query keeps stable, so only Home spun —
which is why it survived earlier testing.

**Fix:** the hook now holds the callback in a ref and the focus effect has **empty deps**. A
caller must not have to memoise to use it safely.

```ts
const latest = useRef(refetch);
latest.current = refetch;
useFocusEffect(useCallback(() => { …latest.current() }, []));
```

---

## 2. Register shop — fields that didn't match

Checked against the prototype's `isAddShop` block (line 504).

| Design field | Was | Now |
|---|---|---|
| Shop number | ✅ | placeholder now `A-31`, as the design |
| Business name **on the board** | label was "Business name" | label and placeholder match |
| Wing or lane — chips (`wingOptions`) | free-text input | **still free text** — see §5 |
| **Floor** — chips (`floorOptions`) | **missing** | **still absent** — see §5 |
| How it **is** run — chips | ✅ | ✅ |
| Licence holder — 2 mode chips + inline search | one button → modal sheet | **rebuilt**, see §3 |
| `nextStepNote` | missing | added |
| "Save shop & continue" | said "Register shop" | fixed |

---

## 3. Register shop — the licence holder is now a two-mode choice

The design (`holderModes`, `showHolderPicker`) offers two explicit modes:

```
Licence holder
[ Pick an existing member ] [ Add a new person ]
   ↳ when picking: an inline search revealed in place
{ nextStepNote }
[ Save shop & continue ]
```

Previously there was a single **Choose licence holder** button that opened the pick sheet, with
"create new" inside it. The capability existed but was two taps deep and easy to miss — which is
exactly the complaint raised. It is now a first-class choice on the screen.

New component **`components/search/PersonPicker.tsx`** — an *inline* person search, not a sheet,
so the shop fields stay visible above it while you search.

`nextStepNote` tells you what "continue" will do:

| State | Note |
|---|---|
| no mode chosen | "A shop always has exactly one licence holder." |
| Add a new person | "Next: their name, photo, phone, address and Aadhaar." |
| Pick existing, none yet | "Search an existing member by name or phone number." |
| Pick existing, chosen | "{name} will hold the licence for this shop." |

---

## 4. Add a member — the search sheet **is** in the design

This one was queried as a mistake, and it isn't. The prototype has it at line 1456,
`showPickSheet`:

```
{{ pickTitle }}
"Search first — the person may already be on record at another shop."
[ Name or phone number ]
"Type a name or number to check whether this person is already registered."
[ Cancel ]  [ Not on record — create new ]
```

`+ Add a member` calls `openPickAny` → that sheet → either link an existing person, or
`pickCreateNew`, which then opens the `addPerson` form. Spec §7.3 makes the same point.

**But it had a real flaw:** "Not on record — create new" only appeared *after* you typed
something. If you already knew the person wasn't registered, the sheet read as a dead end. It is
now always visible beside Cancel, exactly as the design has it, and the copy matches the
prototype's wording.

### The form itself was wrong, though

The design's `isAddPerson` has a form-level **"Role in the market"** chip row and an **inline**
shop search under "Linked shop", with `+ Link another shop & role`. That had been implemented as
role chips *inside* a shop-picker sheet — a second modal on top of the form.

Rebuilt as **`features/people/components/ShopLinksField.tsx`**, rendered inline in the form:

```
Role in the market   [ Renter ] [ Staff ]
"The licence holder is set through shop registration or a transfer, so owner isn't offered here."
Linked shop
  MK-1  Shree Ganesh Flowers   [Staff]  ×
  [ Search shop no. or business name ]        ← inline, collapses after the first link
  [ + Link another shop & role ]
"A person can hold more than one place — e.g. owner of A-12 and renter of L3-11."
```

Pick the role, tap a shop from the results, the link is added and the search clears. New
component **`components/search/ShopPicker.tsx`** for the inline shop search.

`ShopSearchSheet` is still used — on the member profile's "Link another shop & role", which the
design does present as a sheet (`showLinkSheet`).

### Copy aligned to the prototype

Full name placeholder "As written on the Aadhaar card" · "WhatsApp number for receipts" ·
Aadhaar note "Stored encrypted. Once saved, the image can only be opened by the admin —
collectors cannot view it again." · consent "The member has agreed to the association keeping
their Aadhaar copy and contact details on record."

---

## 5. Two design fields intentionally not built

Both were raised and decided: **the API stays exactly as it is.**

**Floor.** The design has a `floorOptions` chip row (Ground floor / First floor / Open stall) and
the functional spec lists it (§4.1), but the v1 API has **no `floor` column** — api slice 1
decided "No wings, no floors, no managed lane list". There is nowhere to send it, so it is
omitted rather than collected and discarded. Add the column server-side if it's wanted later.

**Wing or lane as chips.** The design shows chips; the API stores `lane` as free text with no
master list, and the spec explicitly says the list "must be editable by the association, not
hardcoded". Left as a free-text field. Options considered and not taken: deriving chips from
lanes already in the register, or adding `GET /shops/lanes`.

The *filter* chips on the shops **list** are unaffected — those are already derived from loaded
pages.

---

## 6. New and changed files

```
new     components/search/PersonPicker.tsx        inline person search
new     components/search/ShopPicker.tsx          inline shop search
new     components/search/PersonResultRow.tsx     shared result row
new     features/people/components/ShopLinksField.tsx
changed hooks/useRefreshOnFocus.ts                the loop fix
changed components/search/PersonSearchSheet.tsx   always-visible create-new; design copy;
                                                  now uses PersonResultRow
changed features/shops/ShopFormScreen.tsx         two-mode holder, inline picker, nextStepNote
changed features/people/AddMemberScreen.tsx       inline links field instead of a sheet
changed features/people/MemberForm.tsx            copy aligned to the prototype
```

`tsc --noEmit` clean.

---

## 7. Not re-verified

The API-level harnesses ([08](08-verification.md)) still pass — nothing changed in `src/api`.
What has **not** been re-checked is the UI itself: the register-shop two-mode flow, the inline
pickers, and Home no longer looping all need a device pass. The loop fix in particular is
reasoned rather than observed.
