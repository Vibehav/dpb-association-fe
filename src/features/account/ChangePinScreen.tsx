import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { authApi, errorMessage } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { CodeDots } from "../../components/auth/CodeDots";
import { Keypad } from "../../components/auth/Keypad";
import { Banner, Button, Card, Screen } from "../../components/ui";
import { useCountdown } from "../../hooks/useCountdown";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { OTP_LENGTH, PIN_LENGTH } from "../../utils/validators";

type Props = NativeStackScreenProps<AppStackParamList, "ChangePin">;

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Change your own M-PIN from Account (integration doc §5.9).
 *
 * Runs the same OTP → new-PIN flow as a forgotten PIN, because that *is* the flow — there
 * is no separate change-PIN endpoint. One screen with three steps rather than reusing the
 * sign-in stack, which isn't mounted while you're signed in.
 *
 * `pin/set` returns a fresh token pair and does **not** bump `token_version`, so changing
 * your PIN doesn't sign you out. `completePinSetup` adopts the new pair regardless.
 */
export function ChangePinScreen({ navigation }: Props) {
  const { phone, completePinSetup } = useAuth();
  const [step, setStep] = useState<"intro" | "otp" | "newPin" | "done">("intro");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCountdown();

  if (!phone) {
    return (
      <Screen>
        <Banner message="Sign in again to change your M-PIN." />
      </Screen>
    );
  }

  async function sendCode() {
    if (busy || cooldown.active) return;
    setBusy(true);
    setError(null);
    try {
      const member = await authApi.checkPhone(phone!);
      await authApi.requestOtp(phone!, "PIN_RESET");
      setEmailHint(member.emailHint);
      setCode("");
      cooldown.start(RESEND_COOLDOWN_SECONDS);
      setStep("otp");
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't send a code."));
    } finally {
      setBusy(false);
    }
  }

  async function verify(candidate: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { resetToken: token } = await authApi.verifyOtp(phone!, candidate);
      setResetToken(token);
      setPin("");
      setStep("newPin");
    } catch (caught) {
      setCode("");
      setError(errorMessage(caught, "That code didn't work."));
    } finally {
      setBusy(false);
    }
  }

  async function save(candidate: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await completePinSetup(phone!, resetToken, candidate);
      setStep("done");
    } catch (caught) {
      setPin("");
      setError(errorMessage(caught, "Couldn't set your M-PIN."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {step === "intro" ? (
        <>
          <Card>
            <Text style={typography.eyebrow}>Change your M-PIN</Text>
            <Text style={typography.body}>
              We&apos;ll email a one-time code to your registered email address. Enter it, then
              choose a new {PIN_LENGTH}-digit PIN.
            </Text>
          </Card>
          {error ? <Banner message={error} /> : null}
          <Button label="Send code" icon="send-outline" loading={busy} onPress={sendCode} />
        </>
      ) : null}

      {step === "otp" ? (
        <>
          <View style={styles.block}>
            <Text style={typography.bodySmall}>Code emailed to</Text>
            <Text style={styles.mono}>{emailHint ?? "your registered email address"}</Text>
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
              if (next.length === OTP_LENGTH) verify(next);
            }}
          />
          <Pressable onPress={sendCode} disabled={busy || cooldown.active} hitSlop={8} style={styles.link}>
            <Text style={[typography.bodySmall, cooldown.active ? styles.muted : styles.action]}>
              {cooldown.active ? `Resend in ${cooldown.remaining}s` : "Resend code"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {step === "newPin" ? (
        <>
          <View style={styles.block}>
            <Text style={typography.eyebrow}>Choose a new {PIN_LENGTH}-digit M-PIN</Text>
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
              if (next.length === PIN_LENGTH) save(next);
            }}
          />
        </>
      ) : null}

      {step === "done" ? (
        <>
          <Banner tone="success" message="Your M-PIN has been changed. Use it the next time the app locks." />
          <Button label="Done" icon="checkmark" onPress={() => navigation.goBack()} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: "center", gap: spacing.xs },
  mono: { ...typography.mono, fontSize: 13 },
  link: { alignItems: "center" },
  muted: { color: colors.muted },
  action: { color: colors.primary }
});
