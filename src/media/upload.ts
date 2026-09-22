/**
 * The image pipeline: compress → presign → PUT straight to storage → return the key.
 *
 * The API never receives image bytes (integration doc §6, api slice 4). It mints a
 * presigned PUT, the client uploads directly to S3/MinIO, and only the opaque `key` goes
 * back into a person payload or a retake call.
 */

import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat, type Action } from "expo-image-manipulator";
import { fetch as expoFetch } from "expo/fetch";
import { ApiError, mediaApi, type MediaType } from "../api";

/**
 * Longest edge after resize. A modern phone camera produces 4–8 MB per shot; an ID proof
 * and a face are both legible well under this, and the difference is a two-second save
 * versus a timeout on market-grade signal.
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.7;
const CONTENT_TYPE = "image/jpeg";

export type CapturedImage = {
  uri: string;
  /** From `ImagePickerAsset`. Used to resize the *longer* edge rather than blindly the width. */
  width?: number;
  height?: number;
};

/**
 * Compress and upload one image. Resolves to the storage key to submit.
 *
 * Throws `ApiError`: `upload_failed` when storage rejects the PUT, or the usual API codes
 * (`forbidden` for a viewer, `unauthorized`) from the presign call.
 */
export async function uploadImage(type: MediaType, image: CapturedImage): Promise<string> {
  const compressed = await compress(image);
  const file = new File(compressed.uri);

  try {
    return await put(type, file);
  } finally {
    // `manipulateAsync` always writes a fresh file into the cache directory, so this is
    // never the picker's own asset. Left alone, every capture would leak a scratch file.
    try {
      if (file.exists) file.delete();
    } catch {
      // Best effort — a stale cache file must never fail an upload that worked.
    }
  }
}

async function compress(image: CapturedImage) {
  return manipulateAsync(image.uri, resizeActions(image), {
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG
  });
}

function resizeActions({ width, height }: CapturedImage): Action[] {
  // Dimensions unknown: compress only. Resizing on a guess would upscale a small image.
  if (!width || !height) return [];

  if (Math.max(width, height) <= MAX_EDGE) return [];

  // Constrain the long edge so a portrait ID-proof photo isn't left 4,000px tall.
  return width >= height ? [{ resize: { width: MAX_EDGE } }] : [{ resize: { height: MAX_EDGE } }];
}

async function put(type: MediaType, file: File): Promise<string> {
  let status = 0;
  let detail = "";

  // Two attempts: a presigned URL lives about five minutes, so the one recoverable
  // failure is an expired signature. Everything else is real and fails fast.
  for (let attempt = 0; attempt < 2; attempt++) {
    // Presigned *late* and used immediately, per §6 — never at form-open.
    const { key, uploadUrl } = await mediaApi.uploadUrl(type);

    const response = await expoFetch(uploadUrl, {
      method: "PUT",
      // No Authorization header. The URL carries its own signature, and an extra auth
      // header makes some S3 configurations reject the request outright.
      headers: { "Content-Type": CONTENT_TYPE },
      // `File` implements Blob, and `expo/fetch` streams a Blob body from disk rather
      // than pulling the whole image into JS memory.
      body: file
    });

    if (response.ok) return key;

    status = response.status;
    detail = await response.text().catch(() => "");

    // Storage answers 403 for an expired or mismatched signature — the one case a fresh
    // URL fixes.
    if (status !== 403) break;
  }

  throw new ApiError(status, "upload_failed", uploadFailureMessage(status, detail));
}

function uploadFailureMessage(status: number, detail: string) {
  if (status === 0) return "The image couldn't be uploaded. Check your connection.";
  if (status === 403) return "The upload link expired. Please try again.";
  if (status === 413) return "That image is too large to upload.";
  // Storage errors come back as XML, which is useless to a collector in a market.
  if (__DEV__ && detail) console.warn(`[upload] storage returned ${status}: ${detail.slice(0, 300)}`);
  return "The image didn't upload. Please try again.";
}
