import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, spacing } from "../../theme";

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** 4 for an M-PIN, 6 for an OTP. */
  maxLength: number;
  /** Ignore presses while a request is in flight. */
  disabled?: boolean;
};

/**
 * The in-app numeric keypad. The PIN is never typed on the system keyboard.
 *
 * Laid out as **explicit rows of three with `flex: 1`**, not a wrapping list of
 * percentage-width keys. `width: "30%"` only accounts for 90% of the row, so the leftover
 * 10% floated around as slack and the columns didn't line up between rows.
 *
 * Measurements come from the prototype (`keypad` in the design source):
 * `padding: 16px 0`, `border-radius: 16px`, `gap: 10px`, 3 equal columns, digits at 21px in
 * IBM Plex Mono. The blank key in the last row is rendered but invisible, which is what
 * keeps `0` centred and the backspace on the right.
 */
const ROWS: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "back"]
];

export function Keypad({ value, onChange, maxLength, disabled }: Props) {
  return (
    <View style={styles.pad}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, columnIndex) => {
            const blank = key === "";
            const isBackspace = key === "back";

            return (
              <Pressable
                key={`${rowIndex}-${columnIndex}`}
                disabled={blank || disabled}
                accessibilityRole={blank ? "none" : "button"}
                accessibilityLabel={isBackspace ? "Delete" : key}
                onPress={() => {
                  if (isBackspace) onChange(value.slice(0, -1));
                  else if (value.length < maxLength) onChange(value + key);
                }}
                style={({ pressed }) => [
                  styles.key,
                  blank && styles.blank,
                  pressed && !blank && !disabled && styles.pressed
                ]}
              >
                {isBackspace ? (
                  <Ionicons name="backspace-outline" size={20} color={colors.text} />
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  key: {
    // Equal thirds, exactly — no leftover slack to drift between rows.
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  // Present in the layout, invisible on screen — holds the column so `0` stays centred.
  blank: { backgroundColor: "transparent", borderColor: "transparent" },
  pressed: { backgroundColor: colors.soft },
  keyText: { fontFamily: fontFamilies.mono, fontSize: 21, color: colors.text }
});
