/**
 * The security invariant: **the Aadhaar endpoint is never called for a non-admin.**
 *
 * Not "called and the 403 is handled" — not called at all. Every successful call writes a
 * VIEW row to `aadhaar_access_log` against the acting user, and a collector must be unable
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
import { AadhaarPanel } from "../components/AadhaarPanel";

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
  id: "p1",
  name: "Sachin Shinde",
  phone: "9892710532",
  whatsappPhone: "9892710532",
  address: "Lane 2",
  aadhaarLast4: "1234",
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
    canViewAadhaar: isAdmin,
    canManageCommittee: isAdmin
  });
}

let client: QueryClient;
let aadhaarUrl: jest.SpyInstance;

beforeEach(() => {
  client = testQueryClient();
  aadhaarUrl = jest
    .spyOn(peopleApi, "aadhaarUrl")
    .mockResolvedValue({ url: "https://storage/signed", expiresInSeconds: 300 });
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
});

const renderPanel = () => render(<AadhaarPanel person={person} />, { wrapper: withQueryClient(client) });

describe("AadhaarPanel — collector", () => {
  beforeEach(() => asRole("COLLECTOR"));

  it("offers no way to view the image, and never calls the endpoint", async () => {
    const { queryByText } = await renderPanel();

    expect(queryByText("View front")).toBeNull();
    expect(queryByText("View back")).toBeNull();
    expect(aadhaarUrl).not.toHaveBeenCalled();
  });

  it("can still re-capture — capture is allowed, viewing never is", async () => {
    const { getAllByText } = await renderPanel();
    // One per side.
    expect(getAllByText("Re-capture")).toHaveLength(2);
    expect(aadhaarUrl).not.toHaveBeenCalled();
  });

  it("says plainly that the image is admin-only", async () => {
    const { getByText } = await renderPanel();
    expect(getByText(/visible to the admin only/i)).toBeTruthy();
  });
});

describe("AadhaarPanel — viewer", () => {
  beforeEach(() => asRole("VIEWER"));

  it("can neither view nor re-capture, and never calls the endpoint", async () => {
    const { queryByText } = await renderPanel();

    expect(queryByText("View front")).toBeNull();
    expect(queryByText("Re-capture")).toBeNull();
    expect(aadhaarUrl).not.toHaveBeenCalled();
  });
});

describe("AadhaarPanel — admin", () => {
  beforeEach(() => asRole("ADMIN"));

  it("does not fetch the image until it is explicitly asked for", async () => {
    await renderPanel();
    // No prefetch on mount — an audit row must mean a deliberate act.
    expect(aadhaarUrl).not.toHaveBeenCalled();
  });

  it("fetches exactly one side when that side's View is pressed", async () => {
    const { getByText } = await renderPanel();

    fireEvent.press(getByText("View front"));

    await waitFor(() => expect(aadhaarUrl).toHaveBeenCalledTimes(1));
    expect(aadhaarUrl).toHaveBeenCalledWith("p1", "FRONT");
  });
});

describe("AadhaarPanel — metadata shown to everyone", () => {
  it("shows the last four digits, since only the image is restricted", async () => {
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
