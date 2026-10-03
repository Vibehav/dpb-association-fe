import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../../../theme";

export type StatusTone = "success" | "notice" | "error" | "muted";

const TONES: Record<StatusTone, { background: string; foreground: string }> = {
  success: { background: colors.successSoft, foreground: colors.success },
  notice: { background: colors.noticeSoft, foreground: colors.noticeText },
  error: { background: colors.errorSoft, foreground: colors.error },
  muted: { background: colors.soft, foreground: colors.secondaryText }
};

/** A small coloured tag — "Fee paid", "Due", "CANCELLED". Read-only, unlike `Chip`. */
export function StatusTag({ label, tone }: { label: string; tone: StatusTone }) {
  const { background, foreground } = TONES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </View>
  );
}

/** The tone a fee status reads in: paid is good news, anything owed is a notice. */
export function feeTone(status: string): StatusTone {
  if (status === "PAID") return "success";
  if (status === "PENDING" || status === "PARTIAL") return "notice";
  return "muted";
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill
  },
  label: { fontSize: 11, fontWeight: "500" }
});
