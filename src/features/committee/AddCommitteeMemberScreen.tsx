import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, isCode, type Role } from "../../api";
import { Banner, Button, Card, Chip, ChipRow, Field, PhoneField, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { normalisePhone } from "../../utils/phone";
import { firstError, validateEmail, validateName, validatePhone } from "../../utils/validators";
import { useAddCommitteeMember } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "AddCommitteeMember">;

const ROLES: { value: Role; label: string; description: string[] }[] = [
  {
    value: "COLLECTOR",
    label: "Collector",
    description: [
      "Registers and edits shops and members",
      "Captures photos and ID-proof copies",
      "Cannot open a stored ID-proof image",
      "Cannot transfer a licence",
      "Cannot delete anything"
    ]
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: [
      "Can do everything in the register",
      "Can open ID-proof images",
      "Can transfer licences",
      "Can delete records",
      "Can manage the committee"
    ]
  },
  {
    value: "VIEWER",
    label: "Viewer",
    description: [
      "Reads the register only",
      "Cannot add or change anything",
      "Cannot open ID-proof images"
    ]
  }
];

/**
 * Add someone who can sign in (integration doc §5.10).
 *
 * Name, number, email and role — **the admin never sets a PIN.** The member is created with
 * `pinSet: false` and walks through the first-login OTP flow themselves the first time they
 * open the app. That's the whole onboarding path; there is no invite to send.
 */
export function AddCommitteeMemberScreen({ navigation }: Props) {
  const add = useAddCommitteeMember();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("COLLECTOR");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    const message = firstError(validateName(name), validatePhone(phone), validateEmail(email));
    setFormError(message);
    setPhoneError(null);
    setEmailError(null);
    if (message) return;

    try {
      await add.mutateAsync({ name: name.trim(), phone: normalisePhone(phone), email: email.trim(), role });
      navigation.goBack();
    } catch (caught) {
      // The API's uniqueness is among *active* members, so a freed number is fine to reuse.
      if (isCode(caught, "duplicate_phone")) {
        setPhoneError("This number is already on the committee.");
        return;
      }
      if (isCode(caught, "duplicate_email")) {
        setEmailError("This email is already used by another active committee member.");
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
          placeholder="Vinod Kumar"
          value={name}
          onChangeText={setName}
          autoCorrect={true}
          uppercase
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
        <Field
          label="Email address"
          placeholder="name@example.com"
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setEmailError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          error={emailError}
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
        {selected ? (
          <View style={styles.description}>
            {selected.description.map((item) => (
              <Text key={item} style={typography.body}>
                • {item}
              </Text>
            ))}
          </View>
        ) : null}
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
  note: { marginTop: spacing.xs },
  description: { marginTop: spacing.xs, gap: spacing.xs }
});
