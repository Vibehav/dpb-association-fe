import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { useFonts } from "expo-font";
import { Platform } from "react-native";

/**
 * The two typefaces the prototype is built on. `theme/typography.ts` previously named
 * them but nothing loaded them, so every heading fell back to the system sans and the
 * design lost most of its character.
 */
export const fontFamilies = {
  /** Headings, association name, large figures. */
  serif: "InstrumentSerif_400Regular",
  /** Numbers, labels, the `+91` prefix — anything that should align in a column. */
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
  /** Body copy stays on the platform sans, matching the prototype's Helvetica Neue. */
  sans: Platform.select({ ios: "Helvetica Neue", default: "sans-serif" }) as string
};

/** Gate the app on these being ready, so text doesn't reflow after first paint. */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    InstrumentSerif_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium
  });
  // A font that fails to load should not block sign-in — fall through to the system face.
  return loaded || Boolean(error);
}
