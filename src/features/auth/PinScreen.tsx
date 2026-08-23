import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { authApi, errorMessage, isCode } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { CodeDots } from "../../components/auth/CodeDots";
import { Keypad } from "../../components/auth/Keypad";
import { Banner } from "../../components/ui";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatPhone } from "../../utils/phone";
import { PIN_LENGTH } from "../../utils/validators";
import { AuthShell } from "./AuthShell";

type Props = NativeStackScreenProps<AuthStackParamList, "Pin">;

/**
 * Step 2 — the 4-digit M-PIN, submitted automatically on the fourth digit.
 *
 * The error routing here is the whole point of the screen (integration doc §2.2 / §10):
 * a wrong PIN clears and offers a reset, a locked account says so, and a PIN that was
 * never set (or was reset by an admin mid-session) drops into the first-login OTP flow
 * rather than showing a dead end.
 */
export function PinScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const { signIn } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(candidate: string) {
    // Guarded rather than driven by an effect on `pin.length`, so a fourth digit typed
    // during a slow request can't fire a second login attempt.
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await signIn(phone, candidate);
      // On success the root navigator swaps this stack out; nothing more to do.
    } catch (caught) {
      setPin("");

      if (isCode(caught, "pin_not_set")) {
        // An admin reset this member's PIN. Send them through first-login.
        await startOtp("FIRST_LOGIN");
        return;
      }
      if (isCode(caught, "not_on_committee")) {
        // Removed while the PIN screen was open. Phone is always directly beneath.
        navigation.goBack();
        return;
      }
      setError(errorMessage(caught, "Couldn't sign in."));
    } finally {
      setBusy(false);
    }
  }

  async function startOtp(purpose: "FIRST_LOGIN" | "PIN_RESET") {
    setBusy(true);
    setError(null);
    try {
      await authApi.requestOtp(phone, purpose);
      navigation.navigate("Otp", { phone, purpose });
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't send a code."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <View style={styles.block}>
        <Text style={styles.phone}>{formatPhone(phone)}</Text>
        <Text style={typography.eyebrow}>Enter your 4-digit M-PIN</Text>
      </View>

      <CodeDots filled={pin.length} total={PIN_LENGTH} />
      {error ? <Banner message={error} /> : null}

      <Keypad
        value={pin}
        maxLength={PIN_LENGTH}
        disabled={busy}
        onChange={(next) => {
          setPin(next);
          setError(null);
          if (next.length === PIN_LENGTH) submit(next);
        }}
      />

      <View style={styles.links}>
        <Pressable onPress={() => navigation.goBack()} disabled={busy} hitSlop={8}>
          <Text style={styles.muted}>Change number</Text>
        </Pressable>
        <Pressable onPress={() => startOtp("PIN_RESET")} disabled={busy} hitSlop={8}>
          <Text style={styles.link}>Forgot M-PIN?</Text>
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
