import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { errorMessage } from "../../api";
import { Banner, Button, ErrorState, Field, LoadingScreen, PhoneField, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { normalisePhone } from "../../utils/phone";
import { validateWhatsApp } from "../../utils/validators";
import { useDonor, useUpdateDonor } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "DonorEdit">;

/**
 * Fix a donor's details. `PATCH /donors/{id}` is a **full replace** — an omitted field is
 * cleared — so every field is pre-filled and sent back. Receipts already issued keep the name
 * they were printed with; only future ones change.
 */
export function DonorEditScreen({ navigation, route }: Props) {
  const { donorId } = route.params;
  const donor = useDonor(donorId);
  const update = useUpdateDonor(donorId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [address, setAddress] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded || !donor.data) return;
    const d = donor.data;
    setName(d.name);
    setPhone(d.phone ?? "");
    setWhatsapp(d.whatsappPhone && d.whatsappPhone !== d.phone ? d.whatsappPhone : "");
    setOrganisation(d.organisation ?? "");
    setAddress(d.address ?? "");
    setLoaded(true);
  }, [donor.data, loaded]);

  if (donor.isPending) return <LoadingScreen />;
  if (donor.error || !donor.data) {
    return (
      <Screen>
        <ErrorState error={donor.error} title="Couldn't load the donor" onRetry={donor.refetch} />
      </Screen>
    );
  }

  async function onSave() {
    setError(null);
    if (!name.trim()) {
      setError("Enter the donor's name.");
      return;
    }
    const phoneError = validateWhatsApp(phone) ?? validateWhatsApp(whatsapp);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    try {
      await update.mutateAsync({
        name: name.trim(),
        ...(phone ? { phone: normalisePhone(phone) } : {}),
        ...(whatsapp ? { whatsappPhone: normalisePhone(whatsapp) } : {}),
        ...(organisation.trim() ? { organisation: organisation.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {})
      });
      navigation.goBack();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <Text style={typography.bodySmall}>Receipts already issued keep the name they were printed with.</Text>
      <Field label="Name" value={name} onChangeText={setName} uppercase />
      <PhoneField label="Phone (optional)" value={phone} onChangeText={setPhone} />
      <PhoneField label="WhatsApp, if different (optional)" value={whatsapp} onChangeText={setWhatsapp} />
      <Field label="Organisation (optional)" value={organisation} onChangeText={setOrganisation} uppercase />
      <Field label="Address (optional)" value={address} onChangeText={setAddress} uppercase multiline />
      {error ? <Banner message={error} /> : null}
      <Button label="Save" loading={update.isPending} onPress={onSave} />
    </Screen>
  );
}
