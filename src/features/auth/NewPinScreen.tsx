import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, isCode } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { CodeDots } from "../../components/auth/CodeDots";
import { Keypad } from "../../components/auth/Keypad";
import { Banner } from "../../components/ui";
import type { AuthStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { PIN_LENGTH } from "../../utils/validators";
import { AuthShell } from "./AuthShell";

type Props = NativeStackScreenProps<AuthStackParamList, "NewPin">;

/**
 * Step 4 — set the PIN and sign in.
 *
 * Single entry, no confirm step, matching the prototype and integration doc §2.2. A
 * mistyped PIN is recoverable through "Forgot M-PIN?", though a confirm step would be
 * worth discussing.
 */
export function NewPinScreen({ navigation, route }: Props) {
  const { phone, resetToken, purpose } = route.params;
  const { completePinSetup } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(candidate: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await completePinSetup(phone, resetToken, candidate);
      // Success signs the user in; the root navigator replaces this stack.
    } catch (caught) {
      setPin("");
      if (isCode(caught, "invalid_reset_token")) {
        // The reset token expired while this screen was open — start the code again.
        setError("That took too long. Ask for a new code.");
        navigation.goBack();
        return;
      }
      setError(errorMessage(caught, "Couldn't set your M-PIN."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow={purpose === "FIRST_LOGIN" ? "Set up your M-PIN" : "Choose a new M-PIN"}>
      <View style={styles.block}>
        <Text style={typography.eyebrow}>Set a new {PIN_LENGTH}-digit M-PIN</Text>
        <Text style={typography.bodySmall}>You&apos;ll use this every time you sign in.</Text>
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
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: "center", gap: spacing.xs }
});
