import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

export type BannerTone = "error" | "notice" | "success";

type Props = {
  message: string;
  tone?: BannerTone;
};

/** Inline message for form-level and screen-level feedback. */
export function Banner({ message, tone = "error" }: Props) {
  const { background, foreground, icon } = tones[tone];
  return (
    <View style={[styles.wrapper, { backgroundColor: background }]} accessibilityRole="alert">
      <Ionicons name={icon} size={16} color={foreground} />
      <Text style={[styles.text, { color: foreground }]}>{message}</Text>
    </View>
  );
}

const tones: Record<BannerTone, { background: string; foreground: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error: { background: colors.errorSoft, foreground: colors.error, icon: "alert-circle-outline" },
  notice: { background: colors.noticeSoft, foreground: colors.noticeText, icon: "information-circle-outline" },
  success: { background: colors.successSoft, foreground: colors.success, icon: "checkmark-circle-outline" }
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.md
  },
  text: { ...typography.bodySmall, flex: 1 }
});
