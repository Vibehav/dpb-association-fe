/**
 * Wire types — a 1:1 mirror of the API's DTOs.
 *
 * These are the shapes that cross the network. Nothing here is reshaped for the UI: the
 * previous client mapped responses into invented view models and quietly lost fields
 * (`tenancy`) and invented others (`floor`, `feeStatus`) that the v1 API does not have.
 * Screens consume these directly.
 *
 * Sources: `docs/frontend-integration.md` §7 and the API's slice docs 02–05.
 * Optional fields are typed `| null` because that is what Jackson serialises.
 */

/**
 * Every entity id on the wire.
 *
 * Server-issued `bigint`s, serialised as JSON numbers (`"id": 201`). They were UUID strings
 * until 2026-09-17; see the API's `docs/id-bigint-migration-plan.md`. Values stay far inside
 * `Number.MAX_SAFE_INTEGER`, so no string handling is needed — but keep the alias rather than
 * writing `number` inline, so a future change is one line.
 */
export type Id = number;

// ---------------------------------------------------------------------------
// enums
// ---------------------------------------------------------------------------

/** Committee role. Decides what the signed-in user may do. */
export type Role = "ADMIN" | "COLLECTOR" | "VIEWER";

/** Informational — how the shop is run. There is no `floor` field in v1. */
export type Tenancy = "OWNER_RUN" | "RENTED_OUT";

/**
 * The role a person holds *at a particular shop*. The same person can be OWNER at one
 * shop and RENTER at another.
 *
 * The functional spec mentions a fourth role, "Worker"; the API dropped it as identical
 * to STAFF (api slice 1). Do not reintroduce it.
 */
export type LinkRole = "OWNER" | "RENTER" | "STAFF";

/** Roles an ordinary add-link flow may create. OWNER comes only from register/transfer. */
export type LinkableRole = Extract<LinkRole, "RENTER" | "STAFF">;
export const LINKABLE_ROLES: LinkableRole[] = ["RENTER", "STAFF"];

/**
 * The government ID the association holds a copy of. Mirrors the API's `IdProofType`.
 *
 * `DRIVING_LICENSE` is the API's spelling and it is American. **Do not "correct" it** — it
 * is the wire value, and an unknown string is a 400 `validation_error` because Jackson
 * cannot deserialise it. The *display* spelling is Indian English; see `idProofLabel`.
 */
export type IdProofType = "AADHAAR" | "DRIVING_LICENSE" | "PASSPORT" | "VOTER_ID" | "PAN";

/** Picker order: Aadhaar first, because it is what all but a handful of members present. */
export const ID_PROOF_TYPES: IdProofType[] = [
  "AADHAAR",
  "DRIVING_LICENSE",
  "PASSPORT",
  "VOTER_ID",
  "PAN"
];

/**
 * `ID_PROOF_FRONT` and `ID_PROOF_BACK` map to the **same** `id-proofs/` prefix server-side,
 * so the API cannot catch a front/back mix-up — only a photo key used as an ID-proof key or
 * vice versa (400 `invalid_media_key`). Wiring each capture slot to the right value is
 * therefore entirely this client's responsibility.
 */
export type MediaType = "PHOTO" | "ID_PROOF_FRONT" | "ID_PROOF_BACK";

/** Case-sensitive on the wire: it is a path segment bound by Spring's default converter. */
export type IdProofSide = "FRONT" | "BACK";
export type OtpPurpose = "FIRST_LOGIN" | "PIN_RESET";

// ---------------------------------------------------------------------------
// shared
// ---------------------------------------------------------------------------

/** `page` is 0-based. `size` defaults to 20 server-side and is capped at 100. */
export type Paged<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export type PhoneCheckResponse = {
  onCommittee: boolean;
  /** Present only when on the committee — used to greet and confirm the right number. */
  firstName: string | null;
  /** Null when not on the committee; false means route into the first-login OTP flow. */
  pinSet: boolean | null;
  /** Masked delivery address. Null for a number that is not on the committee. */
  emailHint: string | null;
};

export type ResetTokenResponse = { resetToken: string };

export type Me = {
  id: Id;
  name: string;
  role: Role;
};

// ---------------------------------------------------------------------------
// shops
// ---------------------------------------------------------------------------

export type ShopListItem = {
  id: Id;
  shopNumber: string;
  /** Null when the trading name is not recorded yet. Render via `shopTitle`. */
  businessName: string | null;
  lane: string;
  tenancy: Tenancy;
  /**
   * Null on a shop with **no licence holder** — a real state, not just defensiveness. A
   * member deleted before the API guarded that took their owner link with them, and those
   * shops stay ownerless until someone transfers into them.
   */
  licenceHolderName: string | null;
  /** Present only when someone holds a RENTER link. */
  rentedToName: string | null;
  staffCount: number;
};

export type PersonAtShop = {
  /** Target for `DELETE /links/{linkId}`. */
  linkId: Id;
  personId: Id;
  name: string;
  phone: string;
  role: LinkRole;
};

export type ShopDetail = {
  id: Id;
  shopNumber: string;
  /** Null when the trading name is not recorded yet. Render via `shopTitle`. */
  businessName: string | null;
  lane: string;
  tenancy: Tenancy;
  /** Set by a transfer: "Previously: {name} · licence held till {till}". */
  formerHolderName: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  formerHolderTill: string | null;
  /**
   * Ordered owner, renter, staff. **An OWNER row may be absent** on a shop whose holder was
   * deleted before the API guarded that — and the list can be empty entirely. Find the owner,
   * never index at 0.
   */
  people: PersonAtShop[];
};

/** Exactly one of the two must be set. */
export type OwnerInput =
  | { existingPersonId: Id; newPerson?: never }
  | { newPerson: NewPersonPayload; existingPersonId?: never };

export type RegisterShopRequest = {
  shopNumber: string;
  /**
   * Optional since client revision v1 — a shop is often allotted before its trading name is
   * settled. Omit it, or send `null`/`""`; all three store as null. Never send a placeholder
   * like `"NA"`, which is indistinguishable from a real name once written.
   */
  businessName?: string | null;
  lane: string;
  tenancy: Tenancy;
  owner: OwnerInput;
};

/**
 * All four fields are sent on every edit, per integration doc §5.3.
 *
 * **`PATCH /shops/{id}` is a full replace, not a merge.** `businessName` became optional in
 * client revision v1, which means omitting it no longer fails — it **clears** a name that was
 * set, and the response says nothing about it. Always send the current value back; the edit
 * form must pre-fill the field for exactly this reason.
 */
export type UpdateShopRequest = {
  shopNumber: string;
  businessName?: string | null;
  lane: string;
  tenancy: Tenancy;
};

/** Add a renter or staff member to a shop — existing person or created inline. */
export type AddShopLinkRequest = { role: LinkableRole } & OwnerInput;

/**
 * `tillDate` defaults to today server-side.
 *
 * Transfer both **moves** the licence and **installs** it: on a shop with no current holder
 * it simply assigns one, which is the only route back from that state — registration is past
 * and `addLink` rejects OWNER. Installing into a vacancy leaves `formerHolderName` /
 * `formerHolderTill` untouched, because nobody was succeeded.
 */
export type TransferRequest = OwnerInput & { tillDate?: string };

export type ShopListParams = {
  query?: string;
  /** Free text; there is no lane master table and no distinct-lanes endpoint. */
  lane?: string;
  page?: number;
  size?: number;
};

// ---------------------------------------------------------------------------
// people
// ---------------------------------------------------------------------------

export type PersonShopLink = {
  linkId: Id;
  shopId: Id;
  shopNumber: string;
  /** Null when the trading name is not recorded yet. Render via `shopTitle`. */
  businessName: string | null;
  role: LinkRole;
};

export type PersonListItem = {
  id: Id;
  name: string;
  /** 10 digits, no country code. Format for display; send the digits. */
  phone: string;
  shops: PersonShopLink[];
};

export type PersonProfile = {
  id: Id;
  name: string;
  phone: string;
  whatsappPhone: string;
  address: string | null;
  /**
  * Which ID is on file, or `null` when none is — a **pending** member.
  *
  * Optional since client revision v2: the register is loaded from the client's own records,
  * which carry names, phones, photos and shop links but no documents. `null` here means the
  * document has not been captured *yet*, not that it is hidden — a viewer and an admin both
  * see `null` for a pending member.
  */
  idProofType: IdProofType | null;
  /** Last four characters — letters are possible, a PAN ends in one. Null when unrecorded. */
  idProofLast4: string | null;
  consent: boolean;
  addedByName: string | null;
  /** ISO instant. Times are UTC — present in IST. */
  addedOn: string;
  /**
  * Short-lived signed URL (~5 min), safe to put straight in an `<Image>`. **Null for a
  * photoless member** — the profile endpoint no longer breaks on one, which is the substance
  * of client revision v3. A 500 here is a regression, not a data problem.
  */
  photoUrl: string | null;
  shops: PersonShopLink[];
};

/** The inline-new-person payload, shared by add-member, register-shop and transfer. */
export type NewPersonPayload = {
  name: string;
  phone: string;
  /** Defaults to `phone` server-side when omitted. */
  whatsappPhone?: string;
  address?: string;
  /**
  * From the upload flow. **Optional since client revision v3** — omit it to enrol a
  * <b>photoless</b> member, photographed later via `PUT /people/{id}/photo`.
  *
  * Unlike the ID proof there is no all-or-nothing rule: this is a single field, so skipping
  * it is unambiguous and is coupled to nothing else. A member may carry either image, both,
  * or neither.
  */
  photoKey?: string;
  /**
  * Which document was captured. **Optional since client revision v2** — omit it, with
  * `idProofFrontKey`, to enrol a pending member whose document is captured later.
  *
  * The four ID-proof fields are **all-or-nothing**: send `idProofType` *and*
  * `idProofFrontKey` together, or send none of the four. A type with no image, an image with
  * no type, or a lone `idProofBackKey`/`idProofLast4` is a 400 `validation_error` naming
  * `idProofConsistent`. Practically: let the user complete the ID-proof section or skip it
  * whole — never half.
  */
  idProofType?: IdProofType;
  /** From the upload flow, captured as `ID_PROOF_FRONT`. Required *with* `idProofType`. */
  idProofFrontKey?: string;
  /** From the upload flow, `ID_PROOF_BACK`. Optional — a PAN card has no useful back. */
  idProofBackKey?: string;
  /**
   * Optional, exactly 4 letters or digits.
   *
   * **Omit the key entirely when blank; never send `""`.** The API's `@Pattern` has no
   * `@NotBlank` beside it, so an empty string *fails* validation while an absent key is
   * accepted. This is the one trap in the whole contract.
   */
  idProofLast4?: string;
  /** Must be true. */
  consent: boolean;
};

export type CreatePersonRequest = {
  person: NewPersonPayload;
  /** At least one, and RENTER/STAFF only — an OWNER link here is a 400. */
  links: { shopId: Id; role: LinkableRole }[];
};

export type UpdatePersonRequest = {
  name: string;
  phone: string;
  whatsappPhone?: string;
  address?: string;
};

export type AddPersonLinkRequest = { shopId: Id; role: LinkableRole };

/**
 * Body of `PUT /people/{id}/id-proof` — a **whole-document** replace, and the only way to
 * change the type.
 *
 * Every field is written unconditionally server-side: an omitted `backKey` **clears** the
 * stored back image and an omitted `last4` **wipes** it to null. There is no partial update
 * here; send the document as it should end up.
 */
export type IdProofReplaceRequest = {
  type: IdProofType;
  frontKey: string;
  backKey?: string;
  /** Omit when blank — `""` is a 400, see `NewPersonPayload.idProofLast4`. */
  last4?: string;
};

/**
 * Narrows the member list by whether a document is on file. `PENDING` is the queue the
 * committee works through after the register is loaded — most of it, at first.
 *
 * An unknown value is a 400 `validation_error`, not a silent "no filter".
 */
export type IdProofFilter = "PENDING" | "CAPTURED";

/**
 * Narrows the member list by whether a photograph is on file. Independent of
 * {@link IdProofFilter} — the two compose, so `?photo=PENDING&idProof=PENDING` is the set of
 * members carrying no image of any kind.
 */
export type PhotoFilter = "PENDING" | "CAPTURED";

export type PeopleListParams = {
  query?: string;
  /** Omit for "All". */
  role?: LinkRole;
  /**
   * Omit for "All". Note the list rows carry **no** ID-proof field of their own, so this
   * filter is the only way to tell pending from captured without opening each profile.
   */
  idProof?: IdProofFilter;
  /**
   * Omit for "All". As with `idProof`, the list rows carry **no** photo field of their own —
   * rows identify by initials — so this filter is the only way to tell photoless from
   * photographed without opening each profile.
   */
  photo?: PhotoFilter;
  page?: number;
  size?: number;
};

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

export type UploadUrlResponse = {
  /** Submit this in the person payload, or in a retake PUT. */
  key: string;
  /** Presigned PUT target. No auth header — and it expires in ~5 minutes. */
  uploadUrl: string;
  expiresInSeconds: number;
};

export type SignedUrlResponse = {
  url: string;
  expiresInSeconds: number;
};

// ---------------------------------------------------------------------------
// committee
// ---------------------------------------------------------------------------

export type CommitteeMember = {
  id: Id;
  name: string;
  phone: string;
  /** Used for first-login and M-PIN reset codes. */
  email: string;
  role: Role;
  active: boolean;
  /** False for a freshly added member — they set their own PIN on first sign-in. */
  pinSet: boolean;
  /** ISO instant when soft-removed; null while active. */
  removedAt: string | null;
};

export type AddCommitteeMemberRequest = {
  name: string;
  phone: string;
  /** Required: first-login and M-PIN reset codes are delivered here. */
  email: string;
  role: Role;
};

/** At least one field must be supplied to `PATCH /committee/{id}`. */
export type UpdateCommitteeMemberRequest = {
  role?: Role;
  email?: string;
  name?: string;
};
