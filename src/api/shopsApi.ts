import { request } from "./client";
import type {
  AddShopLinkRequest,
  Id,
  Paged,
  RegisterShopRequest,
  ShopDetail,
  ShopListItem,
  ShopListParams,
  TransferRequest,
  UpdateShopRequest
} from "./types";

/** Server default is 20, hard cap 100. Never fetch the whole register — ~1,000 shops. */
export const SHOPS_PAGE_SIZE = 20;

export const shopsApi = {
  /**
   * `query` matches shop number, business name, or any linked person's name or phone.
   * `lane` is a free-text filter — there is no lane master table.
   *
   * `feeStatus` narrows to this year's fee position and `arrears=true` to shops still owing
   * on a closed year — server-side, which is what Home's pending lists are built from.
   * `arrears` is sent only when true, so `false` is never a filter.
   */
  list({ query, lane, feeStatus, arrears, page = 0, size = SHOPS_PAGE_SIZE }: ShopListParams) {
    return request<Paged<ShopListItem>>("/shops", {
      query: { query, lane, feeStatus, arrears: arrears ? true : undefined, page, size }
    });
  },

  detail(id: Id) {
    return request<ShopDetail>(`/shops/${id}`);
  },

  /**
   * Register a shop with its licence holder — an existing member, or a new person created
   * inline. This is the only way (besides transfer) an OWNER link comes into being.
   * 409 `duplicate_shop_number`.
   */
  register(body: RegisterShopRequest) {
    return request<ShopDetail>("/shops", { method: "POST", body });
  },

  /** All four fields are sent every time (integration doc §5.3). 409 on a taken number. */
  update(id: Id, body: UpdateShopRequest) {
    return request<ShopDetail>(`/shops/${id}`, { method: "PATCH", body });
  },

  /**
   * Admin only. Soft-deletes and unlinks everyone at the shop.
   *
   * A shop that still owes fees answers **409 `fee_outstanding`** (the message names the
   * amount) unless `confirmOutstanding` is true — the delete prompt is enforced server-side.
   * Once deleted, its dues leave every pending total.
   */
  remove(id: Id, confirmOutstanding = false) {
    return request<void>(`/shops/${id}`, {
      method: "DELETE",
      query: { confirmOutstanding: confirmOutstanding ? true : undefined }
    });
  },

  /**
   * Add a renter or staff member. RENTER/STAFF only — an OWNER role here is a 400
   * `owner_not_addable`. 409 `renter_exists` when a renter already holds the shop.
   */
  addLink(id: Id, body: AddShopLinkRequest) {
    return request<ShopDetail>(`/shops/${id}/links`, { method: "POST", body });
  },

  /**
   * Admin only. Replaces the licence holder and stamps the former holder plus the date.
   * `tillDate` defaults to today. Past contributions stay with the former holder (v2).
   *
   * Also the **only** way to give an ownerless shop a holder: when there is no current
   * owner it installs one instead of failing, and leaves the former-holder record alone.
   * The old `409 no_owner` is gone.
   *
   * **409 `fee_outstanding`** while the shop owes anything, part-paid years included — the
   * dues are collected from the current holder first. Filling a vacancy is not blocked.
   */
  transfer(id: Id, body: TransferRequest) {
    return request<ShopDetail>(`/shops/${id}/transfer`, { method: "POST", body });
  }
};

export const linksApi = {
  /**
   * Admin only. Removes a RENTER or STAFF link. An OWNER link is a 400
   * `owner_not_removable` — the licence changes through transfer, never removal.
   */
  remove(linkId: Id) {
    return request<void>(`/links/${linkId}`, { method: "DELETE" });
  }
};
