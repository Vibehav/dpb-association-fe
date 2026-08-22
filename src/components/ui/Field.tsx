import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, MIN_TOUCH, radii, spacing, typography } from "../../theme";

type Props = TextInputProps & {
  label?: string;
  /** Field-level message, e.g. from a 409 `duplicate_phone`. */
  error?: string | null;
  /** Non-blocking note, e.g. the live duplicate-phone warning while typing. */
  hint?: string | null;
};

export function Field({ label, error, hint, style, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={typography.eyebrow}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, Boolean(error) && styles.inputError, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text
  },
  inputError: { borderColor: colors.error },
  error: { ...typography.bodySmall, color: colors.error },
  hint: { ...typography.bodySmall, color: colors.noticeText }
});
