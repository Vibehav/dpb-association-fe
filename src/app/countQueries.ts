import { hashKey } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

/** A one-row page is enough because the Home cards only use `totalElements`. */
export const COUNT_ONLY = { size: 1 } as const;

// Keep the hashes alongside the shared count parameters so broad list invalidations can
// leave Home's deliberately long-lived count entries alone.
export const shopCountQueryHash = hashKey(queryKeys.shops.list(COUNT_ONLY));
export const peopleCountQueryHash = hashKey(queryKeys.people.list(COUNT_ONLY));
