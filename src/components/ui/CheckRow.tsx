import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, MIN_TOUCH, radii, spacing, typography } from "../../theme";

type Props = {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  /** Secondary line — use it to say what ticking actually means. */
  description?: string;
};

/** A tick row. Used for the consent flag and for "WhatsApp same as phone". */
export function CheckRow({ label, checked, onToggle, description }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
      </View>
      <View style={styles.text}>
        <Text style={typography.body}>{label}</Text>
        {description ? <Text style={typography.bodySmall}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm
  },
  pressed: { opacity: 0.7 },
  box: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { flex: 1, gap: 2 }
});
