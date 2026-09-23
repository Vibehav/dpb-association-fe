/**
 * The replace call is the destructive one, and its failure mode is silent data loss rather
 * than a crash — so these assert the **request body**, not the rendering.
 *
 * `PersonMediaService` writes `backKey` and `last4` *unconditionally*, so anything this
 * screen omits is wiped server-side. And `last4` carries `@Pattern` without `@NotBlank`, so
 * `""` is a 400 while an absent key is accepted. Every test below exists because one of
 * those two facts makes an obvious-looking implementation wrong.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { peopleApi, type MediaType, type PersonProfile } from "../../../api";
import type { CaptureState, ImageCapture } from "../../../media/useImageCapture";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { IdProofReplaceScreen } from "../IdProofReplaceScreen";

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

const ready = (key: string): CaptureState => ({ status: "ready", key, previewUri: `file://${key}` });

let mockSlots: Record<MediaType, ImageCapture>;

jest.mock("../../../media", () => {
  const actual = jest.requireActual("../../../media/validation");
  return {
    imageFieldError: actual.imageFieldError,
    useImageCapture: (type: MediaType) => mockSlots[type]
  };
});

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

let client: QueryClient;
let replaceIdProof: jest.SpyInstance;
const goBack = jest.fn();
const setOptions = jest.fn();

beforeEach(() => {
  client = testQueryClient();
  mockSlots = {
    PHOTO: slot({ status: "empty" }),
    // A front is already captured in most tests: it is the only mandatory field.
    ID_PROOF_FRONT: slot(ready("id-proofs/new-front.jpg")),
    ID_PROOF_BACK: slot({ status: "empty" })
  };
  jest.spyOn(peopleApi, "detail").mockResolvedValue(person);
  replaceIdProof = jest.spyOn(peopleApi, "replaceIdProof").mockResolvedValue(undefined);
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
  goBack.mockReset();
});

async function renderScreen(overrides: Partial<PersonProfile> = {}) {
  if (Object.keys(overrides).length) {
    (peopleApi.detail as jest.Mock).mockResolvedValue({ ...person, ...overrides });
  }
  const view = render(
    <IdProofReplaceScreen
      // `setOptions` too: the screen retitles itself "Capture ID proof" when nothing is on
      // file, so a mock without it throws before anything renders.
      navigation={{ goBack, setOptions } as never}
      route={{ key: "k", name: "IdProofReplace", params: { personId: 1 } } as never}
    />,
    { wrapper: withQueryClient(client) }
  );
  const rendered = await view;
  // The screen renders a spinner until `usePerson` resolves.
  await waitFor(() => expect(rendered.getByText("Document type")).toBeTruthy());
  return rendered;
}

/** The body actually sent to `PUT /people/{id}/id-proof`. */
const sentBody = () => replaceIdProof.mock.calls[0][1];

describe("IdProofReplaceScreen — what it sends", () => {
  it("sends the new type and the freshly captured front key", async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByText("PASSPORT"));
    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({ type: "PASSPORT", frontKey: "id-proofs/new-front.jpg" });
  });

  it("carries the stored last four through a same-type replace", async () => {
    // The wipe guard. The server overwrites `last4` with whatever arrives, so dropping the
    // prefill here would silently erase a value the admin never touched.
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody().last4).toBe("1234");
  });

  it("drops the prefilled last four the moment the document type changes", async () => {
    // An Aadhaar's last four is not a passport's, and a stale prefill would be *saved*.
    const view = await renderScreen();

    await fireEvent.press(view.getByText("PASSPORT"));
    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody()).not.toHaveProperty("last4");
  });

  it("restores the prefill when the type is changed back", async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByText("PASSPORT"));
    await fireEvent.press(view.getByText("AADHAAR"));
    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody().last4).toBe("1234");
  });

  it("omits last4 entirely when cleared, rather than sending an empty string", async () => {
    // `""` is a 400: @Pattern runs with no @NotBlank beside it.
    const view = await renderScreen();

    await fireEvent.changeText(view.getByPlaceholderText("1234"), "");
    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody()).not.toHaveProperty("last4");
  });

  it("uppercases an alphanumeric last four, so a PAN's 234F survives", async () => {
    const view = await renderScreen({ idProofType: "PAN", idProofLast4: null });

    await fireEvent.changeText(view.getByPlaceholderText("1234"), "234f");
    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody().last4).toBe("234F");
  });

  it("omits backKey when no back was captured, and warns that the stored one goes", async () => {
    // This client only ever holds signed URLs, never keys, so the existing back key cannot
    // be resent — a replace is always whole-document. The banner has to say so.
    const view = await renderScreen();

    expect(view.getByText(/images on file are removed/i)).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody()).not.toHaveProperty("backKey");
  });

  it("sends backKey when a back was captured", async () => {
    mockSlots.ID_PROOF_BACK = slot(ready("id-proofs/new-back.jpg"));
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(replaceIdProof).toHaveBeenCalled());
    expect(sentBody().backKey).toBe("id-proofs/new-back.jpg");
  });

  it("returns to the profile once the replace succeeds", async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(goBack).toHaveBeenCalled());
  });
});

describe("IdProofReplaceScreen — what it refuses to send", () => {
  it("will not submit without a front image", async () => {
    mockSlots.ID_PROOF_FRONT = slot({ status: "empty" });
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Replace document"));

    expect(replaceIdProof).not.toHaveBeenCalled();
    expect(view.getByText(/front is required/i)).toBeTruthy();
  });

  it("will not submit while an attempted back upload has failed", async () => {
    // An optional slot that was *tried* is not the same as one never touched. Submitting
    // here would leave the user believing a back page was stored when none was.
    mockSlots.ID_PROOF_BACK = slot({
      status: "failed",
      previewUri: "file://x.jpg",
      message: "Upload failed"
    });
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Replace document"));

    expect(replaceIdProof).not.toHaveBeenCalled();
  });

  it("will not submit a malformed last four", async () => {
    const view = await renderScreen();

    await fireEvent.changeText(view.getByPlaceholderText("1234"), "12");
    await fireEvent.press(view.getByLabelText("Replace document"));

    expect(replaceIdProof).not.toHaveBeenCalled();
    expect(view.getByText(/4 letters or numbers/i)).toBeTruthy();
  });

  it("tells a collector to escalate if the admin-only call is ever reached", async () => {
    // The entry point is admin-gated, so this is belt-and-braces — but "no permission" is
    // not actionable for someone standing in front of a member with a new passport.
    const { ApiError } = jest.requireActual("../../../api/errors");
    replaceIdProof.mockRejectedValue(new ApiError(403, "forbidden", "You do not have permission"));
    const view = await renderScreen();

    await fireEvent.press(view.getByLabelText("Replace document"));

    await waitFor(() => expect(view.getByText(/Ask an admin/i)).toBeTruthy());
  });
});
