import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { authApi, errorMessage, isCode } from "../../api";
import { Banner, Button, PhoneField } from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, typography } from "../../theme";
import { isValidPhone, normalisePhone } from "../../utils/phone";
import { AuthShell } from "./AuthShell";

type Props = NativeStackScreenProps<AuthStackParamList, "Phone">;

/**
 * Step 1 — the number decides the role; there is no role picker (integration doc §2.2).
 *
 * The number is checked **as it is typed**, once ten digits are in, so the member is greeted
 * before they press Continue — that greeting is what confirms they typed the right number
 * (prototype `authGreeting`). Continue then reuses the cached result rather than asking again.
 *
 * A number that isn't on the committee shows nothing while typing; the message only appears
 * on Continue. Flagging it mid-entry would accuse someone of not being on the committee while
 * they were still halfway through their own number.
 */
export function PhoneScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalised = normalisePhone(phone);
  const debounced = useDebouncedValue(normalised, 400);

  const lookup = useQuery({
    queryKey: ["auth", "phone", debounced],
    queryFn: () => authApi.checkPhone(debounced),
    enabled: isValidPhone(debounced),
    retry: false,
    // The answer can change — an admin may add or remove this number — so don't hold it.
    staleTime: 0,
    gcTime: 30_000
  });

  // Only trust the lookup while the field still holds the number it was made for.
  const checked = debounced === normalised && lookup.data ? lookup.data : null;
  const greeting =
    checked?.onCommittee && checked.firstName ? `Welcome back, ${checked.firstName}` : null;

  async function onContinue() {
    setError(null);

    if (!isValidPhone(normalised)) {
      setError("Enter a 10-digit mobile number.");
      return;
    }

    setBusy(true);
    try {
      const result = checked ?? (await authApi.checkPhone(normalised));

      if (!result.onCommittee) {
        setError("This number isn't on the committee.");
        return;
      }

      if (result.pinSet) {
        navigation.navigate("Pin", { phone: normalised });
        return;
      }

      // First login: no PIN yet. Request the code before showing the OTP screen, so the
      // user isn't staring at empty dots before the email has been sent.
      await authApi.requestOtp(normalised, "FIRST_LOGIN");
      navigation.navigate("Otp", {
        phone: normalised,
        purpose: "FIRST_LOGIN",
        emailHint: result.emailHint
      });
    } catch (caught) {
      // A removed member's number reads as "not on the committee" — their row still exists
      // but is inactive, and the number is free to re-add (api slice 5).
      setError(
        isCode(caught, "not_on_committee")
          ? "This number isn't on the committee."
          : errorMessage(caught, "Couldn't check that number.")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <PhoneField
        label="Registered mobile number"
        value={phone}
        onChangeText={(next) => {
          setPhone(next);
          setError(null);
        }}
        autoFocus
      />
      {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
      {error ? <Banner message={error} /> : null}
      <Button label="Continue" loading={busy} onPress={onContinue} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  // Green, as the design has it — a confirmation, not a warning.
  greeting: { ...typography.bodySmall, color: colors.success }
});
