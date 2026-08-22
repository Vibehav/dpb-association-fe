import type { ImageCapture } from "./useImageCapture";

/**
 * The validation message for a required image slot, or null when it's satisfied.
 *
 * A key only exists once the presigned PUT has returned 200, so `capture.key` being set is
 * the client's proof that the object is in storage — which is exactly what the API now
 * checks (`media_not_uploaded`).
 *
 * The point of this over a plain "is the key there" check is telling the two failure modes
 * apart. Saying "capture the member's photo" to someone who already captured it — and is
 * looking at it on screen next to a **Retry upload** button — sends them in the wrong
 * direction entirely.
 */
export function imageFieldError(capture: ImageCapture, label: string): string | null {
  if (capture.key) return null;

  switch (capture.state.status) {
    case "failed":
      return `${label} didn't upload. Tap “Retry upload”, then save again.`;
    case "uploading":
      return `${label} is still uploading.`;
    case "choosing":
      return `Finish choosing ${label.toLowerCase()}.`;
    default:
      return `${label} is required.`;
  }
}
