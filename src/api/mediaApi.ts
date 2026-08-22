import { request } from "./client";

export const mediaApi = {
  uploadUrl(token: string, type: "MEMBER_PHOTO" | "AADHAAR_FRONT" | "AADHAAR_BACK" | "BILL_PHOTO") {
    return request<{ key: string; uploadUrl: string; expiresInSeconds: number }>(
      "/media/upload-url",
      { method: "POST", body: JSON.stringify({ type }) },
      token
    );
  }
};
