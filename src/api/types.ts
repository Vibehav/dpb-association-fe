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

export type MediaType = "PHOTO" | "AADHAAR_FRONT" | "AADHAAR_BACK";
export type AadhaarSide = "FRONT" | "BACK";
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
};

export type ResetTokenResponse = { resetToken: string };

export type Me = {
  id: string;
  name: string;
  role: Role;
};

// ---------------------------------------------------------------------------
// shops
// ---------------------------------------------------------------------------

export type ShopListItem = {
  id: string;
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
  linkId: string;
  personId: string;
  name: string;
  phone: string;
  role: LinkRole;
};

export type ShopDetail = {
  id: string;
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
  | { existingPersonId: string; newPerson?: never }
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
  linkId: string;
  shopId: string;
  shopNumber: string;
  businessName: string;
  role: LinkRole;
};

export type PersonListItem = {
  id: string;
  name: string;
  /** 10 digits, no country code. Format for display; send the digits. */
  phone: string;
  shops: PersonShopLink[];
};

export type PersonProfile = {
  id: string;
  name: string;
  phone: string;
  whatsappPhone: string;
  address: string | null;
  aadhaarLast4: string | null;
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
  /** From the upload flow. Mandatory. */
  aadhaarFrontKey: string;
  aadhaarBackKey?: string;
  aadhaarLast4?: string;
  /** Must be true. */
  consent: boolean;
};

export type CreatePersonRequest = {
  person: NewPersonPayload;
  /** At least one, and RENTER/STAFF only — an OWNER link here is a 400. */
  links: { shopId: string; role: LinkableRole }[];
};

export type UpdatePersonRequest = {
  name: string;
  phone: string;
  whatsappPhone?: string;
  address?: string;
};

export type AddPersonLinkRequest = { shopId: string; role: LinkableRole };

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
  id: string;
  name: string;
  phone: string;
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
  role: Role;
};
