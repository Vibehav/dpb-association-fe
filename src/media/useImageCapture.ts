/**
 * One capture slot — member photo, Aadhaar front, or Aadhaar back.
 *
 * Owns the whole lifecycle: permission → camera or library → compress → upload → key.
 * The important property is that a failed upload is *visible and retryable* and never
 * leaves a key behind, so a form can't look complete when the image never landed
 * (functional spec §13.4 — a save must never appear to succeed when it didn't).
 */

import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, type MediaType } from "../api";
import { cropFreeForm } from "./cropPicker";
import { uploadImage, type CapturedImage } from "./upload";

export type CaptureState =
  | { status: "empty" }
  /** Camera or library sheet is open. */
  | { status: "choosing" }
  | { status: "uploading"; previewUri: string }
  | { status: "ready"; previewUri: string; key: string }
  | { status: "failed"; previewUri: string | null; message: string };

export type ImageCapture = {
  state: CaptureState;
  /** The storage key, present only once the upload has actually succeeded. */
  key: string | null;
  /** Local preview to show while and after capture. */
  previewUri: string | null;
  /** True while a submit should be blocked. */
  busy: boolean;
  captureFromCamera: () => Promise<void>;
  pickFromLibrary: () => Promise<void>;
  /** Re-upload the image already captured — does not reopen the camera. */
  retry: () => Promise<void>;
  clear: () => void;
};

export function useImageCapture(type: MediaType): ImageCapture {
  const [state, setState] = useState<CaptureState>({ status: "empty" });

  // Mirrors `state` so callbacks can read the current value without going stale, and
  // so a cancelled picker can restore what was there before.
  const stateRef = useRef<CaptureState>(state);
  const assetRef = useRef<CapturedImage | null>(null);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const set = useCallback((next: CaptureState) => {
    stateRef.current = next;
    // An upload can outlive the sheet that started it.
    if (mountedRef.current) setState(next);
  }, []);

  const runUpload = useCallback(async () => {
    const asset = assetRef.current;
    if (!asset) return;

    set({ status: "uploading", previewUri: asset.uri });
    try {
      const key = await uploadImage(type, asset);
      set({ status: "ready", previewUri: asset.uri, key });
    } catch (caught) {
      set({
        status: "failed",
        previewUri: asset.uri,
        message: errorMessage(caught, "The image didn't upload.")
      });
    }
  }, [set, type]);

  const launch = useCallback(
    async (source: "camera" | "library") => {
      const previous = stateRef.current;
      set({ status: "choosing" });

      // Aadhaar is a rectangular card, so it gets the free-form cropper. That library
      // handles its own permissions and reports refusals as error codes, so this path
      // skips the expo permission dance entirely.
      if (type !== "PHOTO") {
        try {
          const cropped = await cropFreeForm(source);
          if (!cropped) {
            set(previous);
            return;
          }
          assetRef.current = cropped;
          await runUpload();
        } catch (caught) {
          set({
            status: "failed",
            previewUri: previous.status === "ready" ? previous.previewUri : null,
            message: errorMessage(caught, "Couldn't open the camera.")
          });
        }
        return;
      }

      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        set({
          status: "failed",
          previewUri: previous.status === "ready" ? previous.previewUri : null,
          message:
            source === "camera"
              ? "Camera access is off. Turn it on in Settings to capture."
              : "Photo access is off. Turn it on in Settings to choose an image."
        });
        return;
      }

      const options = pickerOptions();
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      // Backing out of the camera should leave an already-captured image alone.
      if (result.canceled || !result.assets?.length) {
        set(previous);
        return;
      }

      const asset = result.assets[0];
      assetRef.current = { uri: asset.uri, width: asset.width, height: asset.height };
      await runUpload();
    },
    [runUpload, set, type]
  );

  const captureFromCamera = useCallback(() => launch("camera"), [launch]);
  const pickFromLibrary = useCallback(() => launch("library"), [launch]);

  const retry = useCallback(async () => {
    if (!assetRef.current) return;
    await runUpload();
  }, [runUpload]);

  const clear = useCallback(() => {
    assetRef.current = null;
    set({ status: "empty" });
  }, [set]);

  return {
    state,
    key: state.status === "ready" ? state.key : null,
    previewUri: "previewUri" in state ? state.previewUri : null,
    busy: state.status === "choosing" || state.status === "uploading",
    captureFromCamera,
    pickFromLibrary,
    retry,
    clear
  };
}

/**
 * Options for the **member photo** only. Aadhaar goes through `cropPicker.ts` instead,
 * because `expo-image-picker` has no free-form crop on either platform.
 */
function pickerOptions(): ImagePicker.ImagePickerOptions {
  const shared: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    // Full quality out of the picker: `upload.ts` does the single lossy pass, so
    // compressing here too would degrade the image twice for no size benefit.
    quality: 1,
    // Never pull the bytes into JS — these are multi-megabyte images.
    base64: false,
    // Don't carry GPS coordinates around next to a scan of someone's Aadhaar card.
    exif: false
  };

  // A face, shown in a circle — square is right, and it's the only crop iOS offers anyway.
  return { ...shared, allowsEditing: true, aspect: [1, 1] };
}
