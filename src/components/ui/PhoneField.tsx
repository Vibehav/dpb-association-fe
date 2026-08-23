import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, MIN_TOUCH, radii, spacing, typography } from "../../theme";
import { normalisePhone } from "../../utils/phone";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  error?: string | null;
  hint?: string | null;
  autoFocus?: boolean;
  editable?: boolean;
};

/**
 * 10-digit Indian mobile input with a fixed `+91`. Strips anything non-numeric as you
 * type, so a pasted "+91 98200 00000" lands as "9820000000" — the API wants bare digits
 * (integration doc §8, §11).
 */
export function PhoneField({ value, onChangeText, label, error, hint, autoFocus, editable = true }: Props) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={typography.eyebrow}>{label}</Text> : null}
      <View style={[styles.row, Boolean(error) && styles.rowError, !editable && styles.disabled]}>
        <Text style={styles.prefix}>+91</Text>
        <TextInput
          value={value}
          // Normalise, don't truncate: `digitsOnly(next).slice(0, 10)` turned a pasted
          // "+91 9820000000" into "9198200000" — the country code plus the first eight
          // digits of the real number.
          onChangeText={(next) => onChangeText(normalisePhone(next).slice(0, 10))}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          placeholder="10-digit number"
          placeholderTextColor={colors.muted}
          autoFocus={autoFocus}
          editable={editable}
          style={styles.input}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  row: {
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
  rowError: { borderColor: colors.error },
  disabled: { opacity: 0.6 },
  prefix: { fontFamily: fontFamilies.mono, fontSize: 14, color: colors.muted },
  input: {
    flex: 1,
    fontFamily: fontFamilies.mono,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm
  },
  error: { ...typography.bodySmall, color: colors.error },
  hint: { ...typography.bodySmall, color: colors.noticeText }
});
