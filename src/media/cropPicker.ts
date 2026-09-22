/**
 * Free-form cropping, for ID-proof images only.
 *
 * `expo-image-picker` cannot do this: its `aspect` option pins a *fixed* ratio and is
 * ignored on iOS entirely, where the crop is always square — which would slice the ends off
 * a card. `react-native-image-crop-picker` gives a genuinely free-form cropper with rotation
 * and pinch-zoom on both platforms, at the cost of being a native module (so it needs a
 * development build, not Expo Go).
 *
 * Everything odd about the library is contained here, so `useImageCapture` sees the same
 * `{ uri, width, height }` shape it gets from `expo-image-picker`:
 *
 *  - it **throws** on cancellation rather than returning a flag
 *  - it returns `path`, not `uri`, and Android has historically been inconsistent about
 *    whether that path carries a `file://` scheme
 *  - permission refusals arrive as error codes rather than a permission response
 */

import ImageCropPicker from "react-native-image-crop-picker";
import { ApiError } from "../api";

export type CroppedImage = { uri: string; width: number; height: number };

const OPTIONS = {
  cropping: true,
  /** The whole reason this library is here. */
  freeStyleCropEnabled: true,
  mediaType: "photo" as const,
  /** `upload.ts` does the single lossy pass; compressing twice would degrade for nothing. */
  compressImageQuality: 1,
  includeBase64: false,
  /** Android: guarantees a real file on disk rather than a content:// reference. */
  writeTempFile: true,
  /** A library pick could be HEIC; everything downstream assumes JPEG. */
  forceJpg: true,
  enableRotationGesture: true,
  cropperToolbarTitle: "Crop the ID proof",
  cropperChooseText: "Use photo",
  cropperCancelText: "Cancel"
};

/** Resolves to null when the user backs out — never throws for a cancellation. */
export async function cropFreeForm(source: "camera" | "library"): Promise<CroppedImage | null> {
  try {
    const image =
      source === "camera"
        ? await ImageCropPicker.openCamera(OPTIONS)
        : await ImageCropPicker.openPicker(OPTIONS);

    return { uri: withFileScheme(image.path), width: image.width, height: image.height };
  } catch (caught) {
    if (isCancellation(caught)) return null;
    throw asApiError(caught, source);
  }
}

/** Android sometimes returns a bare path; `new File(...)` needs a URI. */
function withFileScheme(path: string) {
  return /^[a-z]+:\/\//i.test(path) ? path : `file://${path}`;
}

function codeOf(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

function isCancellation(error: unknown) {
  if (codeOf(error) === "E_PICKER_CANCELLED") return true;
  // Older versions signalled it only in the message.
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

/** Turn the library's error codes into something the capture slot can display. */
function asApiError(error: unknown, source: "camera" | "library") {
  const code = codeOf(error);

  if (code === "E_NO_CAMERA_PERMISSION") {
    return new ApiError(0, "unknown", "Camera access is off. Turn it on in Settings to capture.");
  }
  if (code === "E_NO_LIBRARY_PERMISSION") {
    return new ApiError(0, "unknown", "Photo access is off. Turn it on in Settings to choose an image.");
  }
  if (code === "E_PICKER_NO_CAMERA") {
    return new ApiError(0, "unknown", "This device has no camera.");
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ApiError(
    0,
    "unknown",
    source === "camera" ? `Couldn't open the camera. ${message}` : `Couldn't open the gallery. ${message}`
  );
}
