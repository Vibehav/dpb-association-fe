/**
 * Wire types — a 1:1 mirror of the API's DTOs.
 *
 * These are the shapes that cross the network. Nothing here is reshaped for the UI: the
 * previous client mapped responses into invented view models and quietly lost fields
 * (`tenancy`) and invented others (`floor`) that the API does not have. Screens consume
 * these directly. (`feeStatus` was once such an invention; it is real since v2 Phase 1.)
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
  /**
   * This year's fee, for the list chip: `PAID` → "Fee paid", `PENDING`/`PARTIAL` → "Due",
   * `NO_DEMAND` → **no chip at all** (no fee year open, or the demand not raised yet).
   */
  feeStatus: FeeStatus;
  /** This year's price. Null under `NO_DEMAND`. */
  feeAmount: number | null;
  /** Paid so far this year. Null under `NO_DEMAND`. */
  feePaid: number | null;
  /** Still due this year. Null under `NO_DEMAND`. */
  feeDue: number | null;
  /** Still due on closed years — arrears. `0` when clear. */
  arrearsAmount: number;
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
  /** This year's fee card. */
  fee: ShopFeeCard;
  /** Closed years, newest first. Empty for a newly registered shop. */
  earlierYears: ShopFeeYear[];
  /**
   * Everything still owed, across every year. The delete prompt shows it, and a licence
   * transfer is refused while `total > 0`.
   */
  feeOutstanding: FeeOutstanding;
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
  /** This year's fee position. Server-side — feeds Home's pending and part-paid lists. */
  feeStatus?: FeeStatus;
  /** Only shops still owing on a closed year. */
  arrears?: boolean;
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
  /** Everything given, cancelled receipts excluded. Never sum a history to get this. */
  lifetimeTotal: number;
  /** The most recent live receipt — both null for someone who has never given. */
  lastContributionAmount: number | null;
  /** ISO instant, UTC. */
  lastContributionAt: string | null;
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
  /** Cancelled receipts excluded. */
  lifetimeTotal: number;
  /** True when the history holds a cancelled receipt — show the "not counted" note. */
  hasCancelled: boolean;
  /** Newest first, **cancelled rows included** so they can be struck through. */
  contributionHistory: ContributionHistoryRow[];
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

// ---------------------------------------------------------------------------
// money — v2 Phase 1 (fee cycle · contributions · receipts · donors)
//
// Source: the API's `docs/fe-handoff-money-phase1.md`. Amounts are JSON numbers in whole
// rupees (`5000.00`, sometimes `0`); format with `formatMoney`. Every total arrives computed
// with cancelled receipts excluded — never sum a list on the client.
// ---------------------------------------------------------------------------

/** `ANNUAL_FEE` needs a member who holds the shop's licence; a donor can only give `ONE_OFF`. */
export type Purpose = "ANNUAL_FEE" | "EVENT_DONATION" | "ONE_OFF";
/** What the collection form offers. `EVENT_DONATION` is refused until Phase 2 brings events. */
export const COLLECTABLE_PURPOSES: Purpose[] = ["ANNUAL_FEE", "ONE_OFF"];

export type PaymentMode = "CASH" | "UPI" | "CHEQUE" | "BANK";
export const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "CHEQUE", "BANK"];

export type Fund = "GENERAL" | "EVENT";
export type PayerType = "MEMBER" | "DONOR";

/** Mandatory on cancel and correct; it goes on the record. */
export type CancelReason =
  | "WRONG_AMOUNT"
  | "WRONG_MEMBER"
  | "DUPLICATE_ENTRY"
  | "CASH_NOT_RECEIVED"
  | "OTHER";
export const CANCEL_REASONS: CancelReason[] = [
  "WRONG_AMOUNT",
  "WRONG_MEMBER",
  "DUPLICATE_ENTRY",
  "CASH_NOT_RECEIVED",
  "OTHER"
];

/**
 * A fee year's position. `PENDING` = nothing paid yet, `PARTIAL` = part paid, `PAID` = done.
 * `NO_DEMAND` describes *this* year only — no fee year open, or the demand not raised.
 */
export type FeeStatus = "NO_DEMAND" | "PENDING" | "PARTIAL" | "PAID";

/** One live receipt paid towards a fee year — an instalment, or the whole fee at once. */
export type FeeReceipt = {
  id: Id;
  receiptNo: string;
  amount: number;
  paymentMode: PaymentMode;
  collectedAt: string;
  payerName: string;
};

/**
 * This year's fee card on the shop screen. Under `NO_DEMAND` the money fields are null and
 * `collectable` is false; `yearLabel` and `meetingNote` are still set when a year is open.
 */
export type ShopFeeCard = {
  feeCycleId: Id | null;
  yearLabel: string | null;
  status: FeeStatus;
  amount: number | null;
  paid: number | null;
  due: number | null;
  meetingNote: string | null;
  /** The server's verdict — follow it for the Collect button, never infer it. */
  collectable: boolean;
  receipts: FeeReceipt[];
};

/** A closed year. Anything still `due` is an arrear and stays collectable. */
export type ShopFeeYear = {
  feeCycleId: Id;
  yearLabel: string;
  status: Exclude<FeeStatus, "NO_DEMAND">;
  /** The year's price. */
  amount: number;
  /** What this shop actually paid — show this, not just `amount`. */
  paid: number;
  due: number;
  collectable: boolean;
  receipts: FeeReceipt[];
};

export type FeeOutstanding = {
  total: number;
  byYear: { feeCycleId: Id; yearLabel: string; due: number }[];
};

export type PayerSummary = {
  type: PayerType;
  id: Id;
  /** As at issue — a reprint matches the original even after a rename. */
  name: string;
  /** "A-12 · Kadam Phool Bhandar · Owner", a donor's organisation, or null. */
  subtitle: string | null;
};

export type AssociationHeader = {
  name: string;
  address: string;
  registrationNo: string;
  treasurerName: string;
  treasurerTitle: string;
};

/** `GET /contributions/{id}` — every role. Also the body of every collect/correct response. */
export type Receipt = {
  id: Id;
  receiptNo: string;
  financialYear: string;
  /** ISO instant, UTC — render in IST. */
  collectedAt: string;
  payer: PayerSummary;
  /** Null when the payer has no number: offer no WhatsApp action. */
  whatsappPhone: string | null;
  purpose: Purpose;
  /** Server-made, carries the fee year and "· part payment". Never rebuild it. */
  purposeLabel: string;
  fund: Fund;
  amount: number;
  /** Indian numbering (lakh/crore). The legally meaningful part — never rebuild it. */
  amountInWords: string;
  /**
   * Fee receipts only: what was still due on that year right after this receipt, **as at
   * issue**. Print "Balance due ₹X" above zero. It never changes — for the live position use
   * the shop's fee card.
   */
  feeBalanceAfter: number | null;
  paymentMode: PaymentMode;
  notes: string | null;
  collectedByName: string | null;
  cancelled: boolean;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  /** On a correction's new receipt. */
  replacesReceiptNo: string | null;
  /** On the cancelled original. */
  replacedByReceiptNo: string | null;
  association: AssociationHeader;
  /** Ready to send. For a cancelled receipt it is the cancellation notice instead. */
  whatsappMessage: string;
};

/** One row of a member's or donor's history. Cancelled rows are included, flagged. */
export type ContributionHistoryRow = {
  id: Id;
  receiptNo: string;
  purpose: Purpose;
  purposeLabel: string;
  amount: number;
  feeBalanceAfter: number | null;
  paymentMode: PaymentMode;
  collectedAt: string;
  collectedByName: string | null;
  cancelled: boolean;
  replacesReceiptNo: string | null;
};

export type NewDonorPayload = {
  /** The only required field. */
  name: string;
  /** Optional — a walk-up donor may not give one, and then gets no WhatsApp receipt. */
  phone?: string;
  whatsappPhone?: string;
  organisation?: string;
  address?: string;
};

/**
 * `POST /contributions`. **Exactly one payer**: `personId`, `donorId` or `newDonor`.
 *
 * `shopId`, `feeCycleId` and `confirmPartPayment` apply to `ANNUAL_FEE` only. Omitting
 * `feeCycleId` means this year; a closed year's id collects an arrear. A short amount is
 * refused with 409 `part_payment_unconfirmed` until it is resent with
 * `confirmPartPayment: true`.
 */
export type CreateContributionRequest = {
  personId?: Id;
  donorId?: Id;
  newDonor?: NewDonorPayload;
  purpose: Purpose;
  /** Whole rupees, > 0. Paise are a 400. */
  amount: number;
  paymentMode: PaymentMode;
  shopId?: Id;
  feeCycleId?: Id;
  confirmPartPayment?: boolean;
  notes?: string;
};

export type CancelContributionRequest = { reason: CancelReason; note?: string };

/** Only the amount can be corrected; a wrong payer is a cancel and a fresh collection. */
export type CorrectContributionRequest = {
  reason: CancelReason;
  note?: string;
  newAmount: number;
  confirmPartPayment?: boolean;
};

export type CancelledReceiptRow = {
  id: Id;
  receiptNo: string;
  payerType: PayerType;
  payerId: Id;
  payerName: string;
  amount: number;
  purposeLabel: string;
  collectedByName: string | null;
  cancelReason: CancelReason;
  cancelNote: string | null;
  cancelledByName: string | null;
  cancelledAt: string;
  replacedByReceiptNo: string | null;
};

// ---- fee cycle (admin) ------------------------------------------------------

export type FeeCycle = {
  id: Id;
  /** "2026-27" — two consecutive years with a hyphen, never an en dash. */
  yearLabel: string;
  amount: number;
  meetingNote: string | null;
  demandRaised: boolean;
  demandRaisedAt: string | null;
  closed: boolean;
  closedAt: string | null;
  /** Nothing paid yet. */
  shopsPending: number;
  pendingAmount: number;
  /** Part paid; `partialDue` is what they still owe. */
  shopsPartial: number;
  partialDue: number;
  shopsPaid: number;
  /** Received against the year, cancelled receipts excluded. */
  collected: number;
};

export type CreateFeeCycleRequest = { yearLabel: string; amount: number; meetingNote?: string };
export type UpdateFeeCycleRequest = { amount?: number; meetingNote?: string };
/** Only demands with nothing paid are re-priced. */
export type RepriceResponse = { amount: number; demandsUpdated: number };
export type RaiseDemandResponse = { shopsCharged: number };

// ---- donors -----------------------------------------------------------------

export type DonorListItem = {
  id: Id;
  name: string;
  phone: string | null;
  organisation: string | null;
};

export type DonorProfile = {
  id: Id;
  name: string;
  phone: string | null;
  whatsappPhone: string | null;
  organisation: string | null;
  address: string | null;
  addedByName: string | null;
  addedOn: string;
  lifetimeTotal: number;
  hasCancelled: boolean;
  contributionHistory: ContributionHistoryRow[];
};

/** A full replace — an omitted optional field is cleared. Past receipts keep their name. */
export type UpdateDonorRequest = {
  name: string;
  phone?: string;
  whatsappPhone?: string;
  organisation?: string;
  address?: string;
};

export type DonorListParams = { query?: string; page?: number; size?: number };

// ---- fund and dashboard -----------------------------------------------------

/** Admin only. `spent` is 0 until Phase 2 brings spending. */
export type FundSummary = {
  fund: Fund;
  collected: number;
  spent: number;
  balance: number;
  receiptCount: number;
};

export type FundIncomeRow = {
  id: Id;
  receiptNo: string;
  payerType: PayerType;
  payerId: Id;
  payerName: string;
  payerSubtitle: string | null;
  purposeLabel: string;
  amount: number;
  paymentMode: PaymentMode;
  collectedAt: string;
  collectedByName: string | null;
  cancelled: boolean;
};

/** Home's fee figures — three separate things, shops no longer on record left out. */
export type DashboardFee = {
  /** Null when no fee year is open. */
  yearLabel: string | null;
  demandRaised: boolean;
  pendingCount: number;
  pendingAmount: number;
  partialCount: number;
  partialDue: number;
  arrearsShopCount: number;
  arrearsAmount: number;
};

export type TopContributor = { payerType: PayerType; payerId: Id; name: string; total: number };

/**
 * `GET /dashboard`, shaped by role on the server. For a collector or viewer `spent` and
 * `balance` are **null** and `showOutgoing` is false — withheld, not merely hidden. Never
 * render a null here as zero.
 */
export type Dashboard = {
  showOutgoing: boolean;
  collected: number;
  spent: number | null;
  balance: number | null;
  shopsOnRecord: number;
  peopleLinked: number;
  fee: DashboardFee;
  /** This financial year, members and donors together. */
  topContributors: TopContributor[];
};
