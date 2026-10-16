import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, MIN_TOUCH, radii, spacing } from "../../theme";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /**
   * Capitalise as typed, where what is typed may become a person's name — record text is
   * capitals. Digits (a phone number) are unaffected.
   */
  uppercase?: boolean;
};

export function SearchBox({ value, onChangeText, placeholder, autoFocus, uppercase }: Props) {
  return (
    <View style={styles.box}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={uppercase ? (next) => onChangeText(next.toUpperCase()) : onChangeText}
        autoCapitalize={uppercase ? "characters" : undefined}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md
  },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: spacing.sm }
});
