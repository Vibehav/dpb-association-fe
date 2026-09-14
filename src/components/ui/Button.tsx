import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, MIN_TOUCH, radii, spacing, typography } from "../../theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = "primary", icon, loading, disabled }: Props) {
  const inert = Boolean(loading || disabled);
  const tint = variant === "primary" || variant === "danger" ? colors.white : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: Boolean(loading) }}
      disabled={inert}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !inert && styles.pressed,
        inert && styles.inert
      ]}
    >
      {/* Condition ? Show : Don't Show [If there is an icon, show it. Otherwise show nothing.]  */}
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={tint} /> : null}
        <Text style={[typography.button, { color: tint }]}>{label}</Text>
        {!loading && icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center"
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.85 },
  inert: { opacity: 0.5 }
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.error }
});
