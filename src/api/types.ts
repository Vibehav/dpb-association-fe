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
  businessName: string;
  lane: string;
  tenancy: Tenancy;
  /** A shop always has exactly one owner, but stay defensive at the boundary. */
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
  businessName: string;
  lane: string;
  tenancy: Tenancy;
  /** Set by a transfer: "Previously: {name} · licence held till {till}". */
  formerHolderName: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  formerHolderTill: string | null;
  /** Ordered owner, renter, staff. */
  people: PersonAtShop[];
};

/** Exactly one of the two must be set. */
export type OwnerInput =
  | { existingPersonId: Id; newPerson?: never }
  | { newPerson: NewPersonPayload; existingPersonId?: never };

export type RegisterShopRequest = {
  shopNumber: string;
  businessName: string;
  lane: string;
  tenancy: Tenancy;
  owner: OwnerInput;
};

/** All four fields are sent on every edit, per integration doc §5.3. */
export type UpdateShopRequest = {
  shopNumber: string;
  businessName: string;
  lane: string;
  tenancy: Tenancy;
};

/** Add a renter or staff member to a shop — existing person or created inline. */
export type AddShopLinkRequest = { role: LinkableRole } & OwnerInput;

/** `tillDate` defaults to today server-side. */
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
  businessName: string;
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
  /** Which ID is on file. Never null — the API's column is `NOT NULL`. */
  idProofType: IdProofType;
  /** Last four characters — letters are possible, a PAN ends in one. Null when unrecorded. */
  idProofLast4: string | null;
  consent: boolean;
  addedByName: string | null;
  /** ISO instant. Times are UTC — present in IST. */
  addedOn: string;
  /** Short-lived signed URL (~5 min), safe to put straight in an `<Image>`. */
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
  /** From the upload flow. Mandatory. */
  photoKey: string;
  /** Which document was captured. Required — null or an unknown value is a 400. */
  idProofType: IdProofType;
  /** From the upload flow, captured as `ID_PROOF_FRONT`. Mandatory. */
  idProofFrontKey: string;
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

export type PeopleListParams = {
  query?: string;
  /** Omit for "All". */
  role?: LinkRole;
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
