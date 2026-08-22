import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../theme";

type Props = {
  /** How many digits have been entered. */
  filled: number;
  /** How many the code has: 4 for an M-PIN, 6 for an OTP. */
  total: number;
};

/**
 * The dot row from the design. Parameterised because the OTP screen needs six —
 * the old `PinDots` hardcoded four, which is why the OTP step fell back to a plain
 * text input and lost the designed keypad.
 */
export function CodeDots({ filled, total }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`${filled} of ${total} digits entered`}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.dot, index < filled && styles.dotFilled]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary }
});
