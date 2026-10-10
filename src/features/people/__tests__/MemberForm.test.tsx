/**
 * The member payload is built in exactly one place, and four endpoints depend on it
 * (`POST /people`, and the `newPerson` nested in shop register / add-link / transfer). So
 * these assert the *payload*, not the pixels.
 *
 * Two of them guard traps the API cannot help with:
 *
 * - `idProofLast4: ""` is a **400**. The field carries `@Pattern` without `@NotBlank`, so an
 *   empty string fails validation while an absent key is accepted.
 * - `ID_PROOF_FRONT` and `ID_PROOF_BACK` share one storage prefix, so the server cannot
 *   catch a front/back mix-up. The `type=` wiring here is the only thing that prevents a
 *   permanently mislabelled record.
 */

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { QueryClient } from "@tanstack/react-query";
import type { MediaType } from "../../../api";
import type { CaptureState, ImageCapture } from "../../../media/useImageCapture";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { MemberForm } from "../MemberForm";

jest.mock("../../../auth/useMe", () => ({ useMe: () => ({ data: null }) }));

/** A capture slot in a given state — mirrors `media/__tests__/validation.test.ts`. */
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

/** Which slot each `useImageCapture(type)` call gets back, keyed by MediaType. */
let mockSlots: Record<MediaType, ImageCapture>;
let mockCapturedTypes: MediaType[];

jest.mock("../../../media", () => {
  const actual = jest.requireActual("../../../media/validation");
  return {
    imageFieldError: actual.imageFieldError,
    useImageCapture: (type: MediaType) => {
      mockCapturedTypes.push(type);
      return mockSlots[type];
    }
  };
});

let client: QueryClient;

beforeEach(() => {
  client = testQueryClient();
  mockCapturedTypes = [];
  mockSlots = {
    PHOTO: slot(ready("photos/p.jpg")),
    ID_PROOF_FRONT: slot(ready("id-proofs/f.jpg")),
    ID_PROOF_BACK: slot({ status: "empty" }),
    BILL: slot({ status: "empty" })
  };
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.clearAllMocks();
});

async function renderForm(onSubmit: jest.Mock) {
  return render(<MemberForm submitLabel="Save" onSubmit={onSubmit} />, {
    wrapper: withQueryClient(client)
  });
}

/**
 * Fill the fields every submit needs, then press Save.
 *
 * Every `fireEvent` is awaited: in this setup they are act-wrapped and asynchronous, so an
 * un-awaited press lands *after* the assertion and the test reads as "never submitted".
 */
async function fillAndSubmit(view: Awaited<ReturnType<typeof renderForm>>) {
  const { getByPlaceholderText, getByLabelText, getByText } = view;
  await fireEvent.changeText(getByPlaceholderText("As written on the ID proof"), "vinod kumar");
  await fireEvent.changeText(getByPlaceholderText("10-digit number"), "9820000000");
  await fireEvent.press(getByLabelText("Consent"));
  await fireEvent.press(getByLabelText("Save"));
}

describe("MemberForm — the ID-proof payload", () => {
  it("wires each capture slot to the right MediaType", async () => {
    await renderForm(jest.fn());
    // The server cannot catch a front/back swap — both keys land under `id-proofs/`. This
    // assertion is the only guard against a wiring typo becoming a mislabelled record.
    expect(mockCapturedTypes).toEqual(["PHOTO", "ID_PROOF_FRONT", "ID_PROOF_BACK"]);
  });

  it("sends the chosen document type, defaulting to Aadhaar", async () => {
    const onSubmit = jest.fn();
    await fillAndSubmit(await renderForm(onSubmit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      idProofType: "AADHAAR",
      idProofFrontKey: "id-proofs/f.jpg",
      photoKey: "photos/p.jpg"
    });
  });

  it("omits idProofLast4 entirely when blank, rather than sending an empty string", async () => {
    const onSubmit = jest.fn();
    await fillAndSubmit(await renderForm(onSubmit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // `not.toHaveProperty`, not `toBeUndefined` — the key must be *absent*. The API answers
    // 400 validation_error for "" because @Pattern runs without @NotBlank beside it.
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("idProofLast4");
  });

  it("omits photoKey when the member is not there to be photographed", async () => {
    const onSubmit = jest.fn();
    const view = await renderForm(onSubmit);

    // As with the ID proof, a key sitting ready in the capture slot must still be left out —
    // the API reads an absent key as "photograph them later" and "" as a 400.
    await fireEvent.press(view.getByLabelText("The member is here to be photographed"));
    await fillAndSubmit(view);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).not.toHaveProperty("photoKey");
    // The ID proof is untouched by the photo toggle — the two are independent.
    expect(payload).toMatchObject({
      idProofType: "AADHAAR",
      idProofFrontKey: "id-proofs/f.jpg",
      consent: true
    });
  });

  it("can skip both images at once, and still sends the rest", async () => {
    const onSubmit = jest.fn();
    const view = await renderForm(onSubmit);

    await fireEvent.press(view.getByLabelText("The member is here to be photographed"));
    await fireEvent.press(view.getByLabelText("The member has their ID proof with them"));
    await fillAndSubmit(view);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    // The minimum a member can be: no image of any kind.
    expect(payload).not.toHaveProperty("photoKey");
    expect(payload).not.toHaveProperty("idProofType");
    expect(payload).not.toHaveProperty("idProofFrontKey");
    // Uppercased by the name Field, as every other member is.
    expect(payload).toMatchObject({ name: "VINOD KUMAR", phone: "9820000000", consent: true });
  });

  it("still demands a photo while the member is present for one", async () => {
    const onSubmit = jest.fn();
    mockSlots.PHOTO = slot({ status: "empty" });
    const view = await renderForm(onSubmit);

    await fillAndSubmit(view);

    // Skipping is a deliberate toggle, never an empty capture slot waved through.
    await waitFor(() =>
      expect(view.getByText("The member photo is required.")).toBeTruthy()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("omits all four ID-proof fields when the member has no document with them", async () => {
    const onSubmit = jest.fn();
    const view = await renderForm(onSubmit);

    // Even with a front key sitting ready in the capture slot, turning the section off must
    // leave every ID-proof field out. The API rejects any half state with a 400 naming
    // `idProofConsistent`, so "front key but no type" is not a lenient payload — it is a
    // rejected one, and the member never gets enrolled.
    await fireEvent.press(view.getByLabelText("The member has their ID proof with them"));
    await fillAndSubmit(view);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).not.toHaveProperty("idProofType");
    expect(payload).not.toHaveProperty("idProofFrontKey");
    expect(payload).not.toHaveProperty("idProofBackKey");
    expect(payload).not.toHaveProperty("idProofLast4");
    // The photo and consent are not part of the relaxation — they stay mandatory.
    expect(payload).toMatchObject({ photoKey: "photos/p.jpg", consent: true });
  });

  it("still demands a front image while the ID-proof section is on", async () => {
    const onSubmit = jest.fn();
    mockSlots.ID_PROOF_FRONT = slot({ status: "empty" });
    const view = await renderForm(onSubmit);

    await fillAndSubmit(view);

    // Skipping is a deliberate toggle, never an empty capture slot waved through.
    await waitFor(() =>
      expect(view.getByText("The aadhaar front is required.")).toBeTruthy()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("omits idProofBackKey when no back was captured", async () => {
    const onSubmit = jest.fn();
    await fillAndSubmit(await renderForm(onSubmit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("idProofBackKey");
  });

  it("accepts an alphanumeric last four and uppercases it, so a PAN can be entered", async () => {
    const onSubmit = jest.fn();
    const view = await renderForm(onSubmit);

    // A number pad could not type this at all, which is why keyboardType was dropped.
    await fireEvent.changeText(view.getByPlaceholderText("1234"), "234f");
    await fillAndSubmit(view);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].idProofLast4).toBe("234F");
  });
});

describe("MemberForm — changing the document type", () => {
  it("switches freely while nothing has been captured", async () => {
    mockSlots.ID_PROOF_FRONT = slot({ status: "empty" });
    const { getByText, queryByText } = await renderForm(jest.fn());

    await fireEvent.press(getByText("PASSPORT"));

    // No confirmation, because there is nothing to lose.
    expect(queryByText("Change document type?")).toBeNull();
    expect(getByText(/PASSPORT front/)).toBeTruthy();
  });

  it("asks before discarding a capture, and clears both slots and the last four", async () => {
    const view = await renderForm(jest.fn());
    await fireEvent.changeText(view.getByPlaceholderText("1234"), "1234");

    await fireEvent.press(view.getByText("PAN CARD"));

    // `idProofType` is the only record of what the stored image is, and only an admin can
    // ever open it — so a carried-over capture would be mislabelled permanently, unnoticed.
    expect(view.getByText("Change document type?")).toBeTruthy();
    await fireEvent.press(view.getByText("Change and start again"));

    expect(mockSlots.ID_PROOF_FRONT.clear).toHaveBeenCalled();
    expect(mockSlots.ID_PROOF_BACK.clear).toHaveBeenCalled();
    expect(view.getByPlaceholderText("1234").props.value).toBe("");
    expect(view.getByText(/PAN CARD front/)).toBeTruthy();
  });

  it("keeps everything when the confirmation is dismissed", async () => {
    const view = await renderForm(jest.fn());

    await fireEvent.press(view.getByText("PASSPORT"));
    await fireEvent.press(view.getByText("Cancel"));

    expect(mockSlots.ID_PROOF_FRONT.clear).not.toHaveBeenCalled();
    expect(view.getByText(/AADHAAR front/)).toBeTruthy();
  });
});
