import { Alert, Linking } from "react-native";
import { dialerUrl, whatsAppUrl } from "./phone";

/**
 * Device hand-offs (functional spec §13.3). These leave the app, so they fail softly:
 * a phone with no WhatsApp installed shouldn't produce an unhandled rejection.
 */

async function open(url: string, unavailableMessage: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Not available", unavailableMessage);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Not available", unavailableMessage);
  }
}

/** Opens the dialer with the number pre-filled — it does not place the call. */
export function callNumber(phone: string) {
  return open(dialerUrl(phone), "This device can't place calls.");
}

/** With `text`, the message is pre-typed — how a receipt reaches the member (§6.7). */
export function openWhatsApp(phone: string, text?: string) {
  return open(whatsAppUrl(phone, text), "WhatsApp doesn't seem to be installed.");
}
