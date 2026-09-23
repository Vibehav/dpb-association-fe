/**
 * The security invariant: **the ID-proof endpoint is never called for a non-admin.**
 *
 * Not "called and the 403 is handled" — not called at all. Every successful call writes a
 * VIEW row to `id_proof_access_log` against the acting user, and a collector must be unable
 * to reach the image at all (spec §4.3, integration doc §9).
 *
 * The server refuses them anyway; this asserts the client never asks, and that the
 * affordance isn't even on screen.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { peopleApi, type PersonProfile } from "../../../api";
import { usePermissions } from "../../../auth/usePermissions";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { IdProofPanel } from "../components/IdProofPanel";

jest.mock("../../../auth/usePermissions");

// The real hook pulls in expo-image-picker / expo-file-system / expo-image-manipulator.
// The panel only needs a slot that reports "nothing captured".
jest.mock("../../../media", () => ({
  useImageCapture: () => ({
    state: { status: "empty" },
    key: null,
    previewUri: null,
    busy: false,
    captureFromCamera: jest.fn(),
    pickFromLibrary: jest.fn(),
    retry: jest.fn(),
    clear: jest.fn()
  })
}));

const mockPermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;

const person: PersonProfile = {
  id: 1,
  name: "Sachin Shinde",
  phone: "9892710532",
  whatsappPhone: "9892710532",
  address: "Lane 2",
  idProofType: "AADHAAR",
  idProofLast4: "1234",
  consent: true,
  addedByName: "Ishwar",
  addedOn: "2026-08-22T10:00:00Z",
  photoUrl: null,
  shops: []
};

function asRole(role: "ADMIN" | "COLLECTOR" | "VIEWER") {
  const isAdmin = role === "ADMIN";
  const canWrite = role === "ADMIN" || role === "COLLECTOR";
  mockPermissions.mockReturnValue({
    role,
    loading: false,
    canRead: true,
    canWrite,
    isAdmin,
    canViewIdProof: isAdmin,
    canChangeIdProofType: isAdmin,
    canCaptureIdProof: canWrite,
    canRemoveIdProof: isAdmin,
    canManageCommittee: isAdmin
  });
}

let client: QueryClient;
let idProofUrl: jest.SpyInstance;

beforeEach(() => {
  client = testQueryClient();
  idProofUrl = jest
    .spyOn(peopleApi, "idProofUrl")
    .mockResolvedValue({ url: "https://storage/signed", expiresInSeconds: 300 });
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
});

let onReplace: jest.Mock;

const renderPanel = (overrides: Partial<PersonProfile> = {}) => {
  onReplace = jest.fn();
  return render(<IdProofPanel person={{ ...person, ...overrides }} onReplace={onReplace} />, {
    wrapper: withQueryClient(client)
  });
};

/**
 * A member enrolled before their document was captured — client revision v2.
 *
 * The panel must not merely grey itself out here: every per-side endpoint answers a pending
 * member with a 404 or a 409, so a "Re-capture" or "View front" button on this state is a
 * button that cannot work. What replaces them is the first capture, which a collector may do.
 */
describe("IdProofPanel — pending member, nothing on file", () => {
  const pending: Partial<PersonProfile> = { idProofType: null, idProofLast4: null };

  it("says nothing is on file, and offers no per-side action to anyone", async () => {
    asRole("ADMIN");
    const { getByText, queryByText } = await renderPanel(pending);

    expect(getByText("No ID proof on file")).toBeTruthy();
    // None of these can succeed against a pending member, so none of them are offered.
    expect(queryByText("View front")).toBeNull();
    expect(queryByText("View back")).toBeNull();
    expect(queryByText("Re-capture")).toBeNull();
    expect(queryByText("Change document type")).toBeNull();
    expect(queryByText("Remove ID proof")).toBeNull();
    expect(idProofUrl).not.toHaveBeenCalled();
  });

  it("lets a collector capture the first document — this is the point of the change", async () => {
    asRole("COLLECTOR");
    const { getByText } = await renderPanel(pending);

    await fireEvent.press(getByText("Capture ID proof"));
    expect(onReplace).toHaveBeenCalled();
  });

  it("offers a viewer nothing to press", async () => {
    asRole("VIEWER");
    const { queryByText, getByText } = await renderPanel(pending);

    expect(getByText("No ID proof on file")).toBeTruthy();
    expect(queryByText("Capture ID proof")).toBeNull();
  });
});

/** Taking a document off file is admin-only, and it deletes the images. */
describe("IdProofPanel — removing the document", () => {
  it("is offered to an admin on a captured member", async () => {
    asRole("ADMIN");
    const { getByText } = await renderPanel();
    expect(getByText("Remove ID proof")).toBeTruthy();
  });

  it("is not offered to a collector", async () => {
    asRole("COLLECTOR");
    const { queryByText } = await renderPanel();
    expect(queryByText("Remove ID proof")).toBeNull();
  });
});

describe("IdProofPanel — collector", () => {
  beforeEach(() => asRole("COLLECTOR"));

  it("offers no way to view the image, and never calls the endpoint", async () => {
    const { queryByText } = await renderPanel();

    expect(queryByText("View front")).toBeNull();
    expect(queryByText("View back")).toBeNull();
    expect(idProofUrl).not.toHaveBeenCalled();
  });

  it("can still re-capture — capture is allowed, viewing never is", async () => {
    const { getAllByText } = await renderPanel();
    // One per side.
    expect(getAllByText("Re-capture")).toHaveLength(2);
    expect(idProofUrl).not.toHaveBeenCalled();
  });

  it("says plainly that the image is admin-only", async () => {
    const { getByText } = await renderPanel();
    expect(getByText(/visible to the admin only/i)).toBeTruthy();
  });
});

describe("IdProofPanel — viewer", () => {
  beforeEach(() => asRole("VIEWER"));

  it("can neither view nor re-capture, and never calls the endpoint", async () => {
    const { queryByText } = await renderPanel();

    expect(queryByText("View front")).toBeNull();
    expect(queryByText("Re-capture")).toBeNull();
    expect(idProofUrl).not.toHaveBeenCalled();
  });
});

describe("IdProofPanel — admin", () => {
  beforeEach(() => asRole("ADMIN"));

  it("does not fetch the image until it is explicitly asked for", async () => {
    await renderPanel();
    // No prefetch on mount — an audit row must mean a deliberate act.
    expect(idProofUrl).not.toHaveBeenCalled();
  });

  it("fetches exactly one side when that side's View is pressed", async () => {
    const { getByText } = await renderPanel();

    await fireEvent.press(getByText("View front"));

    await waitFor(() => expect(idProofUrl).toHaveBeenCalledTimes(1));
    expect(idProofUrl).toHaveBeenCalledWith(1, "FRONT");
  });
});

describe("IdProofPanel — changing which document is on file", () => {
  it("does not offer it to a collector, whose PUT would now 403", async () => {
    asRole("COLLECTOR");
    const { queryByText, getByText, getAllByText } = await renderPanel();

    // Spec §4.3 scopes a collector to re-capturing an unclear copy. Moving the *type*
    // changes what the register asserts about someone's identity, so it is an admin act.
    expect(queryByText("Change document type")).toBeNull();
    // But they still get the escalation path, not silence.
    expect(getByText(/Ask an admin to change the document type/i)).toBeTruthy();
    // And re-capture is still theirs — one button per side.
    expect(getAllByText("Re-capture")).toHaveLength(2);
  });

  it("does not offer it to a viewer, nor the collector's hint", async () => {
    asRole("VIEWER");
    const { queryByText } = await renderPanel();
    expect(queryByText("Change document type")).toBeNull();
    expect(queryByText(/Ask an admin/i)).toBeNull();
  });

  it("offers it to an admin without fetching the stored image", async () => {
    asRole("ADMIN");
    const { getByText } = await renderPanel();

    await fireEvent.press(getByText("Change document type"));

    expect(onReplace).toHaveBeenCalled();
    // The replace screen shows capture slots, not the document on file.
    expect(idProofUrl).not.toHaveBeenCalled();
  });
});

describe("IdProofPanel — metadata shown to everyone", () => {
  it("names the document type rather than assuming Aadhaar", async () => {
    asRole("COLLECTOR");
    // PASSPORT deliberately: the type must come from the record, not a hard-coded string.
    const { getByText, queryByText } = await renderPanel({
      idProofType: "PASSPORT",
      idProofLast4: "4567"
    });

    expect(getByText("PASSPORT ••••4567")).toBeTruthy();
    expect(queryByText(/Aadhaar/i)).toBeNull();
  });

  it("shows the type alone when no last four is on file", async () => {
    asRole("COLLECTOR");
    const { getByText, queryByText } = await renderPanel({
      idProofType: "VOTER_ID",
      idProofLast4: null
    });

    expect(getByText("VOTER ID")).toBeTruthy();
    expect(getByText(/Last four characters not recorded/i)).toBeTruthy();
    expect(queryByText(/••••/)).toBeNull();
  });

  it("shows the last four, since only the image is restricted", async () => {
    asRole("COLLECTOR");
    const { getByText } = await renderPanel();
    expect(getByText(/1234/)).toBeTruthy();
  });

  it("attributes the member record, not the image — the API exposes no capturer", async () => {
    // Guards bug B4: this used to read "Captured by X" using created_by, which named the
    // wrong person after a collector re-captured.
    asRole("ADMIN");
    const { getByText, queryByText } = await renderPanel();
    expect(getByText(/Member added by Ishwar/)).toBeTruthy();
    expect(queryByText(/Captured by/)).toBeNull();
  });
});
