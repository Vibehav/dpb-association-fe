import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { authApi, errorMessage } from "../../api";
import { CodeDots } from "../../components/auth/CodeDots";
import { Keypad } from "../../components/auth/Keypad";
import { Banner } from "../../components/ui";
import { useCountdown } from "../../hooks/useCountdown";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatPhone } from "../../utils/phone";
import { OTP_LENGTH } from "../../utils/validators";
import { AuthShell } from "./AuthShell";

type Props = NativeStackScreenProps<AuthStackParamList, "Otp">;

/** Matches the server's `app.otp.resend-throttle`. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Step 3 — the six-digit code, on the designed keypad rather than the system keyboard.
 *
 * The reset token this produces is held in navigation params and never written to disk.
 */
export function OtpScreen({ navigation, route }: Props) {
  const { phone, purpose, firstName } = route.params;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCountdown(RESEND_COOLDOWN_SECONDS);

  async function submit(candidate: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { resetToken } = await authApi.verifyOtp(phone, candidate);
      navigation.navigate("NewPin", { phone, resetToken, purpose });
    } catch (caught) {
      setCode("");
      setError(errorMessage(caught, "That code didn't work."));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || cooldown.active) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.requestOtp(phone, purpose);
      setCode("");
      cooldown.start(RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't send another code."));
    } finally {
      setBusy(false);
    }
  }

  const heading =
    purpose === "FIRST_LOGIN"
      ? `${firstName ? `${firstName}, s` : "S"}et up your M-PIN`
      : "Reset your M-PIN";

  return (
    <AuthShell eyebrow={heading}>
      <View style={styles.block}>
        <Text style={typography.bodySmall}>We sent a {OTP_LENGTH}-digit code to</Text>
        <Text style={styles.phone}>{formatPhone(phone)}</Text>
      </View>

      <CodeDots filled={code.length} total={OTP_LENGTH} />
      {error ? <Banner message={error} /> : null}

      <Keypad
        value={code}
        maxLength={OTP_LENGTH}
        disabled={busy}
        onChange={(next) => {
          setCode(next);
          setError(null);
          if (next.length === OTP_LENGTH) submit(next);
        }}
      />

      <View style={styles.links}>
        <Pressable onPress={() => navigation.goBack()} disabled={busy} hitSlop={8}>
          <Text style={styles.muted}>Back</Text>
        </Pressable>
        <Pressable onPress={resend} disabled={busy || cooldown.active} hitSlop={8}>
          <Text style={[styles.link, cooldown.active && styles.muted]}>
            {cooldown.active ? `Resend in ${cooldown.remaining}s` : "Resend code"}
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: "center", gap: spacing.xs },
  phone: { ...typography.mono, fontSize: 13 },
  links: { flexDirection: "row", justifyContent: "center", gap: spacing.xl },
  muted: { ...typography.bodySmall, color: colors.muted },
  link: { ...typography.bodySmall, color: colors.primary }
});
