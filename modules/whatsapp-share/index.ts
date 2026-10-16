import { requireOptionalNativeModule } from "expo";

type WhatsAppShareNative = {
  sharePdf(contentUri: string, phone: string): Promise<void>;
};

/**
 * Optional, not required: a build made before this module existed must still open — it
 * fails on Send with a plain message instead of crashing at start, as a missing `ExpoPrint`
 * did on 2026-10-04.
 */
const native = requireOptionalNativeModule<WhatsAppShareNative>("WhatsAppShare");

/**
 * Opens WhatsApp with the PDF attached, aimed at `phone` (country code + number, digits only —
 * `919820000000`). In a saved contact's chat when WhatsApp can resolve the number, otherwise in
 * WhatsApp's picker. Android only.
 */
export function sharePdfToWhatsApp(contentUri: string, phone: string): Promise<void> {
  if (!native) {
    return Promise.reject(
      new Error("This version of the app can't send receipt PDFs. Please update the app.")
    );
  }
  return native.sharePdf(contentUri, phone);
}
