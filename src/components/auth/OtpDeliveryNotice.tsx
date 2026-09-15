import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme";
import { OTP_LENGTH } from "../../utils/validators";

type Props = { emailHint: string | null };

/** Shared delivery copy for every email OTP entry point. */
export function OtpDeliveryNotice({ emailHint }: Props) {
  return (
    <View style={styles.block}>
      <Text style={typography.bodySmall}>We emailed a {OTP_LENGTH}-digit code to</Text>
      <Text style={styles.email}>{emailHint ?? "your registered email address"}</Text>
      <Text style={styles.hint}>If it doesn&apos;t arrive soon, check your spam or junk folder.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: "center", gap: spacing.xs },
  email: { ...typography.mono, fontSize: 13 },
  hint: { ...typography.bodySmall, color: colors.muted, textAlign: "center" }
});
