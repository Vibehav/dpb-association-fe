import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../../theme";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** For when the visible text reads badly aloud — e.g. a removable "Due ✕". */
  accessibilityLabel?: string;
};

/** A filter chip. Also used read-only (no `onPress`) for role and status tags. */
export function Chip({ label, selected, onPress, disabled = false, accessibilityLabel }: ChipProps) {
  const body = (
    <View style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}>
      <Text style={[styles.label, selected && styles.labelSelected, disabled && styles.labelDisabled]}>{label}</Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: Boolean(selected) }}
      hitSlop={6}
    >
      {body}
    </Pressable>
  );
}

/** Horizontally scrolling chip row — lane filters can be long and are free text. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.55 },
  label: { fontSize: 12, color: colors.secondaryText },
  labelSelected: { color: colors.white },
  labelDisabled: { color: colors.muted }
});
