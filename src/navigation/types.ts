import type { NavigatorScreenParams } from "@react-navigation/native";
import type { Id, OtpPurpose } from "../api";

/**
 * Typed route params.
 *
 * Only routes that are actually registered appear here — a param-list entry with no
 * screen behind it typechecks at the call site and then crashes at runtime. Each phase
 * adds its own routes (shop detail and forms in phase 5, member screens in phase 6).
 */

export type AuthStackParamList = {
  Phone: undefined;
  Pin: { phone: string };
  Otp: { phone: string; purpose: OtpPurpose; emailHint: string | null };
  /** `resetToken` is passed in memory only — it is never persisted. */
  NewPin: { phone: string; resetToken: string; purpose: OtpPurpose };
};

/**
 * Home's fee lists hand off to the Shops tab with this filter applied. `ARREARS` maps to
 * `?arrears=true`; the rest are this year's `feeStatus`.
 */
export type ShopFeeFilter = "PENDING" | "PARTIAL" | "PAID" | "ARREARS";

export type MainTabsParamList = {
  Shops: { feeFilter?: ShopFeeFilter } | undefined;
  People: undefined;
  Home: undefined;
  /** Admin only — the tab is not registered for anyone else. */
  Fund: undefined;
};

/**
 * Where a collection starts. Every field is optional because there are many doors in:
 * a shop's Collect (shopId + ANNUAL_FEE, the payer resolved to its licence holder), an
 * arrear (plus feeCycleId), a member's or donor's "Record a contribution", or Home with
 * nothing preset (the payer is then searched for).
 */
export type CollectParams = {
  personId?: Id;
  donorId?: Id;
  purpose?: "ANNUAL_FEE" | "ONE_OFF";
  shopId?: Id;
  /** A closed year's id collects an arrear. Omitted = this year. */
  feeCycleId?: Id;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<MainTabsParamList>;
  Account: undefined;
  ShopDetail: { shopId: Id };
  /** No `shopId` means register a new shop; with one, edit that shop. */
  ShopForm: { shopId?: Id } | undefined;
  /** Link a renter or staff member — existing, or created inline. */
  ShopAddPerson: { shopId: Id };
  /** Admin only. Replace the licence holder. */
  ShopTransfer: { shopId: Id };
  PersonProfile: { personId: Id };
  PersonEdit: { personId: Id };
  /** Swap the whole ID proof — the only way to change its type. Admin or collector. */
  IdProofReplace: { personId: Id };
  /** Standalone add — opens on the search sheet, not the form. */
  AddMember: undefined;
  /** Your own M-PIN: OTP → new PIN, the same flow as a forgotten one. */
  ChangePin: undefined;
  /** Admin only. */
  Committee: undefined;
  AddCommitteeMember: undefined;

  // ---- money (v2 Phase 1) ----
  Collect: CollectParams | undefined;
  /** Receipt view / Reprint — every role. Admins cancel or correct from here. */
  Receipt: { contributionId: Id };
  /** Admin only. */
  ReceiptAction: { contributionId: Id; mode: "cancel" | "correct" };
  /** Admin only. */
  CancelledReceipts: undefined;
  /** Admin only — the annual fee year. */
  FeeCycle: undefined;
  DonorProfile: { donorId: Id };
  DonorEdit: { donorId: Id };
};
