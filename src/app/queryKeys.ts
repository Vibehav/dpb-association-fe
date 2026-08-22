import type { AadhaarSide, PeopleListParams, ShopListParams } from "../api";

/**
 * Every query key in one place, so invalidation after a mutation is a lookup rather
 * than a guess. Keys are hierarchical: invalidating `shops.all` also invalidates every
 * filtered list and every detail below it.
 */
export const queryKeys = {
  me: ["me"] as const,

  shops: {
    all: ["shops"] as const,
    list: (params: ShopListParams) => ["shops", "list", params] as const,
    detail: (id: string) => ["shops", "detail", id] as const
  },

  people: {
    all: ["people"] as const,
    list: (params: PeopleListParams) => ["people", "list", params] as const,
    detail: (id: string) => ["people", "detail", id] as const,
    photo: (id: string) => ["people", "detail", id, "photo"] as const,
    /** Admin-only. Never prefetched, never persisted — the URL is short-lived and logged. */
    aadhaar: (id: string, side: AadhaarSide) => ["people", "detail", id, "aadhaar", side] as const
  },

  committee: {
    all: ["committee"] as const,
    detail: (id: string) => ["committee", "detail", id] as const
  }
};
