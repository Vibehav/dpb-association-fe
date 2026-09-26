/**
 * A member may be photoless since client revision v3 — enrolled before they were
 * photographed, which is how the client's register arrives.
 *
 * The same button serves the first capture and a retake, because they are the same request.
 * What it must not do is say "Retake" to someone who has never been photographed: the
 * collector is standing in front of that member, and the wrong verb reads as a bug in the
 * record rather than a prompt to act.
 */

import type { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { MediaType } from "../../../api";
import type { CaptureState, ImageCapture } from "../../../media/useImageCapture";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { MemberPhoto } from "../components/MemberPhoto";

/** A capture slot in a given state — mirrors `MemberForm.test.tsx`. */
function slot(state: CaptureState): ImageCapture {
  return {
    state,
    key: state.status === "ready" ? state.key : null,
    previewUri: "previewUri" in state ? state.previewUri : null,
    busy: state.status === "choosing" || state.status === "uploading",
    captureFromCamera: jest.fn(),
    pickFromLibrary: jest.fn(),
    retry: jest.fn(),
    clear: jest.fn()
  };
}

let mockSlot: ImageCapture;

jest.mock("../../../media", () => ({
  useImageCapture: (_type: MediaType) => mockSlot
}));

let client: QueryClient;

beforeEach(() => {
  client = testQueryClient();
  mockSlot = slot({ status: "empty" });
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.clearAllMocks();
});

const renderPhoto = async (photoUrl: string | null, canRetake = true) =>
  render(<MemberPhoto personId={1} photoUrl={photoUrl} canRetake={canRetake} />, {
    wrapper: withQueryClient(client)
  });

describe("MemberPhoto — a member with no photograph yet", () => {
  it("offers to add one, not to retake one", async () => {
    const { getByText, queryByText } = await renderPhoto(null);

    expect(getByText("Add photo")).toBeTruthy();
    expect(queryByText("Retake")).toBeNull();
  });

  it("says so in words as well, so the gap is visible and not just an empty frame", async () => {
    const { getByText } = await renderPhoto(null);
    expect(getByText("No photo on file.")).toBeTruthy();
  });

  it("offers a viewer nothing to press", async () => {
    const { queryByText } = await renderPhoto(null, false);
    expect(queryByText("Add photo")).toBeNull();
    expect(queryByText("Retake")).toBeNull();
  });
});

describe("MemberPhoto — a member who has been photographed", () => {
  it("offers a retake", async () => {
    const { getByText, queryByText } = await renderPhoto("https://storage/signed");

    expect(getByText("Retake")).toBeTruthy();
    expect(queryByText("Add photo")).toBeNull();
    expect(queryByText("No photo on file.")).toBeNull();
  });

  it("says Saving while the first photo uploads, not Add photo", async () => {
    // An in-flight upload already shows its preview, so "Add photo" would sit under a
    // photograph. Busy wins over both labels.
    mockSlot = slot({ status: "uploading", previewUri: "file://x.jpg" });
    const { getByText, queryByText } = await renderPhoto(null);

    expect(getByText("Saving…")).toBeTruthy();
    expect(queryByText("Add photo")).toBeNull();
  });
});