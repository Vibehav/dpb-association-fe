import { StyleSheet, View } from "react-native";
import { colors } from "../../theme";

type Props = {
  /** How many digits have been entered. */
  filled: number;
  /** How many the code has: 4 for an M-PIN, 6 for an OTP. */
  total: number;
};

/**
 * The dot row from the design.
 *
 * Solid fills, **no border** — an earlier version drew bordered white circles, which read as
 * hollow rings rather than the design's filled dots. Empty is the border colour, filled is
 * the primary maroon.
 *
 * Sizes are the prototype's (`pinDots` / `otpDots` in the design source): 14px with a 14px
 * gap for a 4-digit PIN, 11px with an 11px gap for a 6-digit OTP — the six-dot row is
 * tighter so it doesn't outgrow the keypad above it.
 */
export function CodeDots({ filled, total }: Props) {
  const size = total > 4 ? 11 : 14;

  return (
    <View
      style={[styles.row, { gap: size }]}
      accessibilityLabel={`${filled} of ${total} digits entered`}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            { width: size, height: size, borderRadius: size / 2 },
            index < filled ? styles.filled : styles.empty
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  filled: { backgroundColor: colors.primary },
  empty: { backgroundColor: colors.border }
});
