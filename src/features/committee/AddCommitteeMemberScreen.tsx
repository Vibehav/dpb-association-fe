import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, isCode, type Role } from "../../api";
import { Banner, Button, Card, Chip, ChipRow, Field, PhoneField, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { normalisePhone } from "../../utils/phone";
import { firstError, validateName, validatePhone } from "../../utils/validators";
import { useAddCommitteeMember } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "AddCommitteeMember">;

const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: "COLLECTOR",
    label: "Collector",
    description:
      "Registers and edits shops and members, and captures photos and Aadhaar copies. Cannot open a stored Aadhaar image, transfer a licence, or delete anything."
  },
  {
    value: "ADMIN",
    label: "Admin",
    description:
      "Everything a collector can, plus opening Aadhaar images, transferring licences, deleting records, and managing the committee."
  },
  {
    value: "VIEWER",
    label: "Viewer",
    description: "Reads the register only. Cannot add or change anything, or open Aadhaar images."
  }
];

/**
 * Add someone who can sign in (integration doc §5.10).
 *
 * Name, number and role only — **the admin never sets a PIN.** The member is created with
 * `pinSet: false` and walks through the first-login OTP flow themselves the first time they
 * open the app. That's the whole onboarding path; there is no invite to send.
 */
export function AddCommitteeMemberScreen({ navigation }: Props) {
  const add = useAddCommitteeMember();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("COLLECTOR");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    const message = firstError(validateName(name), validatePhone(phone));
    setFormError(message);
    setPhoneError(null);
    if (message) return;

    try {
      await add.mutateAsync({ name: name.trim(), phone: normalisePhone(phone), role });
      navigation.goBack();
    } catch (caught) {
      // The API's uniqueness is among *active* members, so a freed number is fine to reuse.
      if (isCode(caught, "duplicate_phone")) {
        setPhoneError("This number is already on the committee.");
        return;
      }
      setFormError(errorMessage(caught));
    }
  }

  const selected = ROLES.find((option) => option.value === role);

  return (
    <Screen>
      <Card>
        <Field
          label="Full name"
          placeholder="Their name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <PhoneField
          label="Mobile number"
          value={phone}
          onChangeText={(next) => {
            setPhone(next);
            setPhoneError(null);
          }}
          error={phoneError}
        />
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Role</Text>
        <ChipRow>
          {ROLES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={role === option.value}
              onPress={() => setRole(option.value)}
            />
          ))}
        </ChipRow>
        {selected ? <Text style={typography.body}>{selected.description}</Text> : null}
      </Card>

      <View style={styles.note}>
        <Banner
          tone="notice"
          message="You don't set their M-PIN. They'll be sent a one-time code and choose their own the first time they sign in."
        />
      </View>

      {formError ? <Banner message={formError} /> : null}

      <Button label="Add member" icon="checkmark" loading={add.isPending} onPress={submit} />
      <Button
        label="Cancel"
        variant="secondary"
        onPress={() => navigation.goBack()}
        disabled={add.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.xs }
});
