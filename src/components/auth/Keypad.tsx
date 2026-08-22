import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, MIN_TOUCH, radii, spacing } from "../../theme";

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** 4 for an M-PIN, 6 for an OTP. */
  maxLength: number;
  /** Ignore presses while a request is in flight. */
  disabled?: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

/** The in-app numeric keypad. The PIN is never typed on the system keyboard. */
export function Keypad({ value, onChange, maxLength, disabled }: Props) {
  return (
    <View style={styles.grid}>
      {KEYS.map((key, index) => {
        const blank = key === "";
        const isBackspace = key === "back";

        return (
          <Pressable
            key={`${key}-${index}`}
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
              <Ionicons name="backspace-outline" size={22} color={colors.secondaryText} />
            ) : (
              <Text style={styles.keyText}>{key}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center"
  },
  key: {
    width: "30%",
    minHeight: MIN_TOUCH + 8,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  blank: { backgroundColor: "transparent", borderColor: "transparent" },
  pressed: { backgroundColor: colors.soft },
  keyText: { fontFamily: fontFamilies.mono, fontSize: 20, color: colors.text }
});
