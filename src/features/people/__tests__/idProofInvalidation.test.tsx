/**
 * Cache rules for the ID-proof signed URLs, where getting it wrong is an audit problem
 * rather than a rendering one.
 *
 * Two independent reasons a stale entry must be **removed** rather than invalidated:
 *
 * 1. A superseded image is enqueued into the API's `orphaned_media` outbox and a daily job
 *    deletes the object from storage. A cached URL for it is a permanent 404 in waiting.
 * 2. Invalidating an *active* query refetches it, and every fetch writes a VIEW row to
 *    `id_proof_access_log`. An audit trail is worthless if it records views nobody made.
 */

import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import { peopleApi } from "../../../api";
import { queryKeys } from "../../../app/queryKeys";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { useIdProofUrl, useRecaptureIdProofSide, useReplaceIdProof, useUpdatePhoto } from "../hooks";

const signed = { url: "https://storage/signed", expiresInSeconds: 300 };

// A QueryClient registers focus/online listeners on mount; without tearing it down jest
// reports "did not exit" and would hang a CI run.
let client: QueryClient;
afterEach(() => {
  client?.clear();
  client?.unmount();
  jest.restoreAllMocks();
});

describe("re-capturing one side", () => {
  it("removes that side's signed URL rather than leaving it to be refetched", async () => {
    jest.spyOn(peopleApi, "updateIdProofSide").mockResolvedValue(undefined);
    client = testQueryClient();
    client.setQueryData(queryKeys.people.idProof("p1", "FRONT"), signed);

    const { result } = await renderHook(() => useRecaptureIdProofSide("p1"), {
      wrapper: withQueryClient(client)
    });
    await result.current.mutateAsync({ side: "FRONT", key: "id-proofs/new.jpg" });

    // Gone, not merely stale — the object behind that URL is queued for deletion.
    expect(client.getQueryData(queryKeys.people.idProof("p1", "FRONT"))).toBeUndefined();
  });

  it("leaves the other side alone, since only one image was superseded", async () => {
    jest.spyOn(peopleApi, "updateIdProofSide").mockResolvedValue(undefined);
    client = testQueryClient();
    client.setQueryData(queryKeys.people.idProof("p1", "FRONT"), signed);
    client.setQueryData(queryKeys.people.idProof("p1", "BACK"), signed);

    const { result } = await renderHook(() => useRecaptureIdProofSide("p1"), {
      wrapper: withQueryClient(client)
    });
    await result.current.mutateAsync({ side: "FRONT", key: "id-proofs/new.jpg" });

    expect(client.getQueryData(queryKeys.people.idProof("p1", "BACK"))).toEqual(signed);
  });
});

describe("replacing the whole document", () => {
  it("removes BOTH sides, because an omitted backKey clears the back outright", async () => {
    jest.spyOn(peopleApi, "replaceIdProof").mockResolvedValue(undefined);
    client = testQueryClient();
    client.setQueryData(queryKeys.people.idProof("p1", "FRONT"), signed);
    client.setQueryData(queryKeys.people.idProof("p1", "BACK"), signed);

    const { result } = await renderHook(() => useReplaceIdProof("p1"), {
      wrapper: withQueryClient(client)
    });
    await result.current.mutateAsync({ type: "PASSPORT", frontKey: "id-proofs/f.jpg" });

    expect(client.getQueryData(queryKeys.people.idProof("p1", "FRONT"))).toBeUndefined();
    expect(client.getQueryData(queryKeys.people.idProof("p1", "BACK"))).toBeUndefined();
  });
});

describe("bulk people invalidations", () => {
  it("never refetches a revealed ID-proof URL, which would log a view nobody asked for", async () => {
    // The regression guard. `people.idProof(id, side)` sits beneath `people.detail(id)`
    // beneath `people.all`, and `invalidateQueries` refetches ACTIVE queries regardless of
    // `refetchOnMount: false` — so retaking a member's photo while an admin had the front
    // open used to write a spurious VIEW row against that admin.
    const idProofUrl = jest.spyOn(peopleApi, "idProofUrl").mockResolvedValue(signed);
    jest.spyOn(peopleApi, "updatePhoto").mockResolvedValue(undefined);
    client = testQueryClient();
    const wrapper = withQueryClient(client);

    // An admin has the front revealed: the query is mounted and enabled.
    await renderHook(() => useIdProofUrl("p1", "FRONT", true), { wrapper });
    await waitFor(() => expect(idProofUrl).toHaveBeenCalledTimes(1));

    const { result } = await renderHook(() => useUpdatePhoto("p1"), { wrapper });
    await result.current.mutateAsync("photos/new.jpg");

    // Still one. The photo retake must not have touched the ID-proof query.
    await waitFor(() => expect(idProofUrl).toHaveBeenCalledTimes(1));
  });
});
