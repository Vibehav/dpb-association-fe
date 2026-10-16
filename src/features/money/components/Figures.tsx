import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "../../../theme";
import { formatMoney } from "../../../utils/format";

/** A row of labelled amounts — "In · Out · Balance", "Collected · Spent". */
export function FigureRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/**
 * One labelled amount. `value` null or undefined renders "—": a withheld or not-yet-loaded
 * figure must never read as ₹0.
 */
export function Figure({ label, value, text }: { label: string; value?: number | null; text?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={typography.eyebrow}>{label}</Text>
      <Text style={styles.value}>{text ?? formatMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  figure: { flex: 1, gap: 2 },
  value: { ...typography.mono, fontSize: 14 }
});
