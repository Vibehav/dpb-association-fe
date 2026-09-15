import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { errorMessage, isCode } from "../../api";
import { Banner, Button, Card, CheckRow, ErrorState, Field, LoadingScreen, PhoneField, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { upperCase } from "../../utils/format";
import { normalisePhone } from "../../utils/phone";
import { firstError, validateName, validatePhone, validateWhatsApp } from "../../utils/validators";
import { usePerson, useUpdatePerson } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "PersonEdit">;

/**
 * Edit a member's contact details — `PATCH /people/{id}` (integration doc §5.8).
 *
 * Photo and Aadhaar are replaced from the profile, not here, because each is its own
 * capture-and-upload flow.
 */
export function PersonEditScreen({ navigation, route }: Props) {
  const { personId } = route.params;
  const person = usePerson(personId);
  const update = useUpdatePerson(personId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sameWhatsApp, setSameWhatsApp] = useState(true);
  const [whatsApp, setWhatsApp] = useState("");
  const [address, setAddress] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const data = person.data;
    if (!data) return;
    setName(upperCase(data.name));
    setPhone(data.phone);
    setSameWhatsApp(data.whatsappPhone === data.phone);
    setWhatsApp(data.whatsappPhone);
    setAddress(upperCase(data.address ?? ""));
  }, [person.data]);

  if (person.isPending) return <LoadingScreen />;
  if (person.error || !person.data) {
    return (
      <Screen>
        <ErrorState error={person.error} title="Couldn't load the member" onRetry={person.refetch} />
      </Screen>
    );
  }

  async function save() {
    const message = firstError(
      validateName(name),
      validatePhone(phone),
      sameWhatsApp ? null : validateWhatsApp(whatsApp)
    );
    setFormError(message);
    setPhoneError(null);
    if (message) return;

    const trimmedAddress = address.trim();
    try {
      await update.mutateAsync({
        name: name.trim(),
        phone: normalisePhone(phone),
        // Send the phone explicitly when they're the same, so clearing a separate
        // WhatsApp number actually takes effect.
        whatsappPhone: sameWhatsApp ? normalisePhone(phone) : normalisePhone(whatsApp),
        ...(trimmedAddress ? { address: trimmedAddress } : {})
      });
      navigation.goBack();
    } catch (caught) {
      if (isCode(caught, "duplicate_phone")) {
        setPhoneError("Another member already has this number.");
        return;
      }
      setFormError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} uppercase />
        <PhoneField
          label="Phone"
          value={phone}
          onChangeText={(next) => {
            setPhone(next);
            setPhoneError(null);
          }}
          error={phoneError}
        />
        <CheckRow
          label="WhatsApp same as phone"
          checked={sameWhatsApp}
          onToggle={setSameWhatsApp}
          description="Receipts will go to this number."
        />
        {!sameWhatsApp ? (
          <PhoneField label="WhatsApp number" value={whatsApp} onChangeText={setWhatsApp} />
        ) : null}
        <Field label="Address" value={address} onChangeText={setAddress} multiline uppercase />
      </Card>

      {formError ? <Banner message={formError} /> : null}

      <Button label="Save changes" icon="checkmark" loading={update.isPending} onPress={save} />
      <Button
        label="Cancel"
        variant="secondary"
        onPress={() => navigation.goBack()}
        disabled={update.isPending}
      />
    </Screen>
  );
}
