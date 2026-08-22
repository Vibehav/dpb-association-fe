import { Shop } from "../types";
import { request } from "./client";

export const shopsApi = {
  list(token: string, search = "") {
    return request<{
      content: Array<{
        id: string;
        shopNumber: string;
        businessName: string;
        lane: string;
        tenancy: string;
        licenceHolderName: string | null;
        rentedToName: string | null;
        staffCount: number;
      }>;
    }>(
      `/shops?query=${encodeURIComponent(search)}&page=0&size=50`,
      {},
      token
    ).then((page) =>
      page.content.map<Shop>((shop) => ({
        id: shop.id,
        number: shop.shopNumber,
        businessName: shop.businessName,
        wing: shop.lane,
        floor: shop.tenancy === "OPEN_STALL" ? "Open stall" : "Market",
        ownerName: shop.licenceHolderName || undefined,
        rentedTo: shop.rentedToName || undefined,
        workersCount: shop.staffCount,
        feeStatus: "none"
      }))
    );
  }
};
