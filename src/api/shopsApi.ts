import { request } from "./client";
import type {
  AddShopLinkRequest,
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
   */
  list({ query, lane, page = 0, size = SHOPS_PAGE_SIZE }: ShopListParams) {
    return request<Paged<ShopListItem>>("/shops", { query: { query, lane, page, size } });
  },

  detail(id: string) {
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
  update(id: string, body: UpdateShopRequest) {
    return request<ShopDetail>(`/shops/${id}`, { method: "PATCH", body });
  },

  /** Admin only. Soft-deletes and unlinks everyone at the shop. */
  remove(id: string) {
    return request<void>(`/shops/${id}`, { method: "DELETE" });
  },

  /**
   * Add a renter or staff member. RENTER/STAFF only — an OWNER role here is a 400
   * `owner_not_addable`. 409 `renter_exists` when a renter already holds the shop.
   */
  addLink(id: string, body: AddShopLinkRequest) {
    return request<ShopDetail>(`/shops/${id}/links`, { method: "POST", body });
  },

  /**
   * Admin only. Replaces the licence holder and stamps the former holder plus the date.
   * `tillDate` defaults to today. Past contributions stay with the former holder (v2).
   */
  transfer(id: string, body: TransferRequest) {
    return request<ShopDetail>(`/shops/${id}/transfer`, { method: "POST", body });
  }
};

export const linksApi = {
  /**
   * Admin only. Removes a RENTER or STAFF link. An OWNER link is a 400
   * `owner_not_removable` — the licence changes through transfer, never removal.
   */
  remove(linkId: string) {
    return request<void>(`/links/${linkId}`, { method: "DELETE" });
  }
};
