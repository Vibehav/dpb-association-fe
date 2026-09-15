/**
 * Guards bug B8 — deleting a record refetched it and earned a 404.
 *
 * `people.detail(id)` and `people.idProof(id, side)` are keyed *beneath* `people.all`, so
 * invalidating `all` after a delete refetched two queries for a person who no longer existed,
 * while their screen was still mounted. It showed up as a pair of `404 person_not_found` in
 * the API log on every delete.
 *
 * Delete must invalidate the **lists** only.
 */

import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import { peopleApi, shopsApi } from "../../../api";
import { queryKeys } from "../../../app/queryKeys";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { useDeleteShop } from "../../shops/hooks";
import { useDeletePerson } from "../hooks";

const emptyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };

// A QueryClient registers focus/online listeners on mount; without tearing it down jest
// reports "did not exit" and would hang a CI run.
let client: QueryClient;
afterEach(() => {
  client?.clear();
  client?.unmount();
  jest.restoreAllMocks();
});
const invalidated = (client: ReturnType<typeof testQueryClient>, key: readonly unknown[]) =>
  client.getQueryState([...key])?.isInvalidated;

describe("useDeletePerson", () => {
  it("invalidates the lists but NOT the deleted person's detail or ID proof", async () => {
    jest.spyOn(peopleApi, "remove").mockResolvedValue(undefined);
    client = testQueryClient();

    client.setQueryData(queryKeys.people.list({}), emptyPage);
    client.setQueryData(queryKeys.people.detail("p1"), { id: "p1", name: "Gone" });
    client.setQueryData(queryKeys.people.idProof("p1", "FRONT"), { url: "…", expiresInSeconds: 300 });
    client.setQueryData(queryKeys.shops.list({}), emptyPage);

    const { result } = await renderHook(() => useDeletePerson(), { wrapper: withQueryClient(client) });
    await result.current.mutateAsync("p1");

    await waitFor(() => expect(invalidated(client, queryKeys.people.list({}))).toBe(true));

    // The two that would 404 for a person who no longer exists.
    expect(invalidated(client, queryKeys.people.detail("p1"))).toBe(false);
    expect(invalidated(client, queryKeys.people.idProof("p1", "FRONT"))).toBe(false);

    // Shops the person was linked to have genuinely lost a row.
    expect(invalidated(client, queryKeys.shops.list({}))).toBe(true);
  });
});

describe("useDeleteShop", () => {
  it("invalidates the lists but NOT the deleted shop's detail", async () => {
    jest.spyOn(shopsApi, "remove").mockResolvedValue(undefined);
    client = testQueryClient();

    client.setQueryData(queryKeys.shops.list({}), emptyPage);
    client.setQueryData(queryKeys.shops.detail("s1"), { id: "s1", shopNumber: "A-1" });
    client.setQueryData(queryKeys.people.list({}), emptyPage);

    const { result } = await renderHook(() => useDeleteShop(), { wrapper: withQueryClient(client) });
    await result.current.mutateAsync("s1");

    await waitFor(() => expect(invalidated(client, queryKeys.shops.list({}))).toBe(true));

    expect(invalidated(client, queryKeys.shops.detail("s1"))).toBe(false);
    // The people are still there; their shop lists just got shorter.
    expect(invalidated(client, queryKeys.people.list({}))).toBe(true);
  });
});
