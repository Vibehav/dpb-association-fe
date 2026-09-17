import type { Id, IdProofSide, PeopleListParams, ShopListParams } from "../api";

/**
 * Every query key in one place, so invalidation after a mutation is a lookup rather
 * than a guess. Keys are hierarchical: invalidating `shops.all` also invalidates every
 * filtered list and every detail below it.
 */
export const queryKeys = {
  me: ["me"] as const,

  shops: {
    all: ["shops"] as const,
    /**
     * Every list, without the details beneath them. Use this after a **delete** —
     * invalidating `all` would refetch the detail of a record that no longer exists and
     * earn a 404 while its screen is still mounted.
     */
    lists: ["shops", "list"] as const,
    list: (params: ShopListParams) => ["shops", "list", params] as const,
    detail: (id: Id) => ["shops", "detail", id] as const
  },

  people: {
    all: ["people"] as const,
    /** See `shops.lists`. */
    lists: ["people", "list"] as const,
    list: (params: PeopleListParams) => ["people", "list", params] as const,
    detail: (id: Id) => ["people", "detail", id] as const,
    photo: (id: Id) => ["people", "detail", id, "photo"] as const,
    /** Admin-only. Never prefetched, never persisted — the URL is short-lived and logged. */
    idProof: (id: Id, side: IdProofSide) => ["people", "detail", id, "id-proof", side] as const
  },

  committee: {
    all: ["committee"] as const,
    detail: (id: Id) => ["committee", "detail", id] as const
  }
};

/**
 * True for an ID-proof signed-URL query. Use it to *exclude* them from bulk invalidations.
 *
 * Their keys sit under `people.detail(id)`, which sits under `people.all` — so
 * `invalidateQueries({ queryKey: people.all })` prefix-matches them, and invalidate refetches
 * **active** queries regardless of `refetchOnMount: false`. Without this guard, retaking a
 * member's photo while an admin has the ID front open writes a VIEW row to
 * `id_proof_access_log` that nobody asked for. Only a deliberate tap may fetch these.
 */
export const isIdProofQuery = (query: { queryKey: readonly unknown[] }) =>
  query.queryKey[3] === "id-proof";
