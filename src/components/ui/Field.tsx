import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, MIN_TOUCH, radii, spacing, typography } from "../../theme";
import { upperCase } from "../../utils/format";

type Props = TextInputProps & {
  label?: string;
  /** Field-level message, e.g. from a 409 `duplicate_phone`. */
  error?: string | null;
  /** Non-blocking note, e.g. the live duplicate-phone warning while typing. */
  hint?: string | null;
  /**
   * Record text — capitalised as it is typed, so the field shows and reports the same
   * value and no uppercasing is needed at the submit sites. `autoCapitalize` alone is only
   * a keyboard hint: paste and autofill bypass it, which is why the value is transformed
   * here as well. Leave off for email and numeric fields.
   */
  uppercase?: boolean;
};

export function Field({ label, error, hint, uppercase, style, value, onChangeText, ...inputProps }: Props) {
  const shown = uppercase && typeof value === "string" ? upperCase(value) : value;
  const handleChange = onChangeText
    ? (next: string) => onChangeText(uppercase ? upperCase(next) : next)
    : undefined;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={typography.eyebrow}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, Boolean(error) && styles.inputError, style]}
        {...inputProps}
        value={shown}
        onChangeText={handleChange}
        autoCapitalize={uppercase ? "characters" : inputProps.autoCapitalize}
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
