import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { CodeDots } from "../../components/auth/CodeDots";
import { Keypad } from "../../components/auth/Keypad";
import { Banner } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { formatPhone } from "../../utils/phone";
import { PIN_LENGTH } from "../../utils/validators";
import { AuthShell } from "./AuthShell";

/**
 * The app-lock screen: after five minutes of inactivity, and on every cold start with a
 * stored session. The tokens keep living underneath — only the PIN is re-asked, and it is
 * never stored on the device (integration doc §2.3).
 */
export function UnlockScreen() {
  const { phone, unlock, signOut } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(candidate: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(candidate);
    } catch (caught) {
      setPin("");
      setError(errorMessage(caught, "Couldn't check your M-PIN."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Welcome back">
      <View style={styles.block}>
        {phone ? <Text style={styles.phone}>{formatPhone(phone)}</Text> : null}
        <Text style={typography.eyebrow}>
          {busy ? "Checking…" : `Enter your ${PIN_LENGTH}-digit M-PIN`}
        </Text>
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

      <Pressable onPress={signOut} disabled={busy} hitSlop={8} style={styles.link}>
        <Text style={styles.linkText}>Sign in with another number</Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: "center", gap: spacing.xs },
  phone: { ...typography.mono, fontSize: 13 },
  link: { alignItems: "center" },
  linkText: { ...typography.bodySmall, color: colors.primary }
});
