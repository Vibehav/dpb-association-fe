import type { NavigatorScreenParams } from "@react-navigation/native";
import type { OtpPurpose } from "../api";

/**
 * Typed route params.
 *
 * Only routes that are actually registered appear here — a param-list entry with no
 * screen behind it typechecks at the call site and then crashes at runtime. Each phase
 * adds its own routes (shop detail and forms in phase 5, member screens in phase 6).
 */

export type AuthStackParamList = {
  Phone: undefined;
  Pin: { phone: string; firstName: string | null };
  Otp: { phone: string; purpose: OtpPurpose; firstName: string | null };
  /** `resetToken` is passed in memory only — it is never persisted. */
  NewPin: { phone: string; resetToken: string; purpose: OtpPurpose };
};

export type MainTabsParamList = {
  Shops: undefined;
  Home: undefined;
  People: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<MainTabsParamList>;
  Account: undefined;
  ShopDetail: { shopId: string };
  /** No `shopId` means register a new shop; with one, edit that shop. */
  ShopForm: { shopId?: string } | undefined;
  /** Link a renter or staff member — existing, or created inline. */
  ShopAddPerson: { shopId: string };
  /** Admin only. Replace the licence holder. */
  ShopTransfer: { shopId: string };
  PersonProfile: { personId: string };
  PersonEdit: { personId: string };
  /** Standalone add — opens on the search sheet, not the form. */
  AddMember: undefined;
  /** Your own M-PIN: OTP → new PIN, the same flow as a forgotten one. */
  ChangePin: undefined;
  /** Admin only. */
  Committee: undefined;
  AddCommitteeMember: undefined;
};
