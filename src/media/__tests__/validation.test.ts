import type { CaptureState, ImageCapture } from "../useImageCapture";
import { imageFieldError } from "../validation";

/** A capture slot in a given state. Only `state` and `key` matter here. */
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

const LABEL = "The member photo";

describe("imageFieldError", () => {
  it("passes only when a key exists — the proof the upload reached storage", () => {
    expect(imageFieldError(slot({ status: "ready", previewUri: "file://x", key: "photos/abc" }), LABEL)).toBeNull();
  });

  it("asks for a capture when nothing has been captured", () => {
    expect(imageFieldError(slot({ status: "empty" }), LABEL)).toBe("The member photo is required.");
  });

  it("says RETRY, not capture, when the upload failed", () => {
    // The whole reason this helper exists. The image is on screen next to a Retry button;
    // telling the user to "capture the member photo" sends them the wrong way — and under
    // the media contract a missing key is now a hard server rejection.
    const message = imageFieldError(
      slot({ status: "failed", previewUri: "file://x", message: "Network request failed" }),
      LABEL
    );
    expect(message).toMatch(/didn't upload/i);
    expect(message).toMatch(/retry/i);
    expect(message).not.toMatch(/is required/i);
  });

  it("says wait while an upload is in flight", () => {
    const message = imageFieldError(slot({ status: "uploading", previewUri: "file://x" }), LABEL);
    expect(message).toMatch(/still uploading/i);
  });

  it("says wait while the picker is open", () => {
    expect(imageFieldError(slot({ status: "choosing" }), LABEL)).toMatch(/finish choosing/i);
  });

  it("uses the label it is given, so each slot names itself", () => {
    expect(imageFieldError(slot({ status: "empty" }), "The ID proof front")).toBe(
      "The ID proof front is required."
    );
  });
});
