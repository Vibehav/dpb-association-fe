import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { authApi, errorMessage, isCode } from "../../api";
import { Banner, Button, PhoneField } from "../../components/ui";
import type { AuthStackParamList } from "../../navigation/types";
import { isValidPhone, normalisePhone } from "../../utils/phone";
import { AuthShell } from "./AuthShell";

type Props = NativeStackScreenProps<AuthStackParamList, "Phone">;

/**
 * Step 1 — the number decides the role; there is no role picker (integration doc §2.2).
 *
 * A number that isn't on the committee stops here. One that is, but has never set a PIN,
 * goes straight into the first-login OTP flow.
 */
export function PhoneScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onContinue() {
    const normalised = normalisePhone(phone);
    setError(null);

    if (!isValidPhone(normalised)) {
      setError("Enter a 10-digit mobile number.");
      return;
    }

    setBusy(true);
    try {
      const check = await authApi.checkPhone(normalised);

      if (!check.onCommittee) {
        setError("This number isn't on the committee.");
        return;
      }

      if (check.pinSet) {
        navigation.navigate("Pin", { phone: normalised, firstName: check.firstName });
        return;
      }

      // First login: no PIN yet. Request the code before showing the OTP screen so the
      // user isn't staring at empty dots waiting for an SMS that hasn't been asked for.
      await authApi.requestOtp(normalised, "FIRST_LOGIN");
      navigation.navigate("Otp", {
        phone: normalised,
        purpose: "FIRST_LOGIN",
        firstName: check.firstName
      });
    } catch (caught) {
      // A removed member's number reads as "not on the committee" — their row still
      // exists but is inactive, and the number is free to re-add (api slice 5).
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
      {error ? <Banner message={error} /> : null}
      <Button label="Continue" loading={busy} onPress={onContinue} />
    </AuthShell>
  );
}
