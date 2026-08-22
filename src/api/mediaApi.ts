import { request } from "./client";
import type { MediaType, UploadUrlResponse } from "./types";

export const mediaApi = {
  /**
   * Mint a presigned PUT target. Admin and collector only.
   *
   * The URL expires in about five minutes, so fetch it immediately before uploading —
   * not when the form opens. The API never receives image bytes; the client PUTs straight
   * to storage and submits the returned `key`.
   *
   * Note the accepted values: `PHOTO`, not `MEMBER_PHOTO`. The previous client sent
   * `MEMBER_PHOTO` and `BILL_PHOTO`, neither of which the API's `MediaType` enum knows.
   */
  uploadUrl(type: MediaType) {
    return request<UploadUrlResponse>("/media/upload-url", { method: "POST", body: { type } });
  }
};
