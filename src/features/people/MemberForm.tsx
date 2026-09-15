/**
 * The member fields — name, photo, contact, address, Aadhaar, consent.
 *
 * A component rather than a screen, deliberately. Shop registration needs it as an inline
 * "step 2 of 2" that hands a `newPerson` payload *back* to be embedded in `POST /shops`
 * (integration doc §5.4) — it must not create the person itself. Rendering it inline
 * beats threading a callback through navigation params, and it matches the design's
 * two-step flow.
 *
 * Callers that genuinely create a standalone member (`POST /people`) add the shop-links
 * section around this and pass the payload on themselves.
 */

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { peopleApi, type NewPersonPayload } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useMe } from "../../auth/useMe";
import { ImageCaptureField } from "../../components/media/ImageCaptureField";
import { Banner, Button, Card, CheckRow, Field, PhoneField } from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { imageFieldError, useImageCapture } from "../../media";
import { spacing, typography } from "../../theme";
import { formatDate } from "../../utils/format";
import { isValidPhone, normalisePhone } from "../../utils/phone";
import {
  firstError,
  validateIdProofLast4,
  validateConsent,
  validateName,
  validatePhone,
  validateWhatsApp
} from "../../utils/validators";

type Props = {
  /** e.g. "Save shop & owner". */
  submitLabel: string;
  submitting?: boolean;
  /** Server-side failure to show above the button, e.g. 409 duplicate_phone. */
  error?: string | null;
  onSubmit: (payload: NewPersonPayload) => void;
  onBack?: () => void;
  /**
   * The shop-links builder, used by a standalone add where at least one RENTER/STAFF link
   * is mandatory. Rendered after the photo, which is where the spec puts it in field order
   * (§7.2). Owner flows leave this out — their link is implied by the shop being created.
   */
  linksSection?: ReactNode;
  /** Checked after the phone, which is where the spec puts links in *validation* order. */
  validateLinks?: () => string | null;
};

export function MemberForm({
  submitLabel,
  submitting,
  error,
  onSubmit,
  onBack,
  linksSection,
  validateLinks
}: Props) {
  const me = useMe();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sameWhatsApp, setSameWhatsApp] = useState(true);
  const [whatsApp, setWhatsApp] = useState("");
  const [address, setAddress] = useState("");
  const [idProofLast4, setIdProofLast4] = useState("");
  const [consent, setConsent] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const photo = useImageCapture("PHOTO");
  const idProofFront = useImageCapture("ID_PROOF_FRONT");
  const idProofBack = useImageCapture("ID_PROOF_BACK");

  // Live duplicate-phone warning while typing (spec §7.2). The server is authoritative and
  // answers 409, but telling the collector before they fill the rest of the form saves a
  // wasted photo and Aadhaar capture.
  const debouncedPhone = useDebouncedValue(normalisePhone(phone), 400);
  const duplicate = useQuery({
    queryKey: queryKeys.people.list({ query: debouncedPhone }),
    queryFn: () => peopleApi.list({ query: debouncedPhone }),
    enabled: isValidPhone(debouncedPhone),
    select: (page) => page.content.find((person) => person.phone === debouncedPhone) ?? null
  });

  const uploading = photo.busy || idProofFront.busy || idProofBack.busy;

  function submit() {
    // Validation order is the one the spec asks for, surfacing one plain message at a time
    // (§7.2): name → phone → at least one shop with a role → photo → Aadhaar front → consent.
    const message = firstError(
      validateName(name),
      validatePhone(phone),
      sameWhatsApp ? null : validateWhatsApp(whatsApp),
      validateLinks ? validateLinks() : null,
      validateIdProofLast4(idProofLast4),
      // State-aware: distinguishes "not captured yet" from "captured but the upload
      // failed". The API now rejects a key whose object never landed in storage.
      imageFieldError(photo, "The member photo"),
      imageFieldError(idProofFront, "The Aadhaar front"),
      validateConsent(consent)
    );
    setValidationError(message);
    if (message) return;

    const trimmedAddress = address.trim();
    const last4 = idProofLast4.trim();

    onSubmit({
      name: name.trim(),
      phone: normalisePhone(phone),
      // Omitted rather than sent empty — the API defaults it to `phone`.
      ...(sameWhatsApp ? {} : { whatsappPhone: normalisePhone(whatsApp) }),
      ...(trimmedAddress ? { address: trimmedAddress } : {}),
      // Non-null by the time validation passes.
      photoKey: photo.key as string,
      idProofFrontKey: idProofFront.key as string,
      ...(idProofBack.key ? { idProofBackKey: idProofBack.key } : {}),
      ...(last4 ? { idProofLast4: last4 } : {}),
      consent: true
    });
  }

  return (
    <View style={styles.stack}>
      <Card>
        <Field
          label="Full name"
          placeholder="As written on the Aadhaar card"
          value={name}
          onChangeText={setName}
          uppercase
        />
        <ImageCaptureField label="Member photo" type="PHOTO" capture={photo} required />
      </Card>

      {linksSection}

      <Card>
        <PhoneField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          hint={duplicate.data ? `${duplicate.data.name} already has this number.` : null}
        />
        <CheckRow
          label="WhatsApp number for receipts"
          checked={sameWhatsApp}
          onToggle={setSameWhatsApp}
          description="Same as the phone number above."
        />
        {!sameWhatsApp ? (
          <PhoneField label="WhatsApp number" value={whatsApp} onChangeText={setWhatsApp} />
        ) : null}
        <Field
          label="Address"
          placeholder="Residential address"
          value={address}
          onChangeText={setAddress}
          multiline
          uppercase
        />
      </Card>

      <Card>
        <ImageCaptureField
          label="Aadhaar front"
          type="ID_PROOF_FRONT"
          capture={idProofFront}
          required
          note="Stored encrypted. Once saved, the image can only be opened by the admin — collectors cannot view it again."
        />
        <ImageCaptureField label="Aadhaar back" type="ID_PROOF_BACK" capture={idProofBack} />
        <Field
          label="Aadhaar — last 4 digits (optional)"
          placeholder="1234"
          value={idProofLast4}
          onChangeText={(next) => setIdProofLast4(next.replace(/\D/g, "").slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
        />
      </Card>

      <Card>
        <CheckRow
          label="Consent"
          checked={consent}
          onToggle={setConsent}
          description="The member has agreed to the association keeping their Aadhaar copy and contact details on record."
        />
        {me.data ? (
          <Text style={typography.bodySmall}>
            Captured by {me.data.name} · {formatDate(new Date().toISOString())}
          </Text>
        ) : null}
      </Card>

      {validationError ? <Banner message={validationError} /> : null}
      {error ? <Banner message={error} /> : null}
      {uploading ? <Banner tone="notice" message="Waiting for an image to finish uploading…" /> : null}

      <Button
        label={submitLabel}
        icon="checkmark"
        loading={submitting}
        // Blocked while an image is still uploading: without its key the member would be
        // saved without the mandatory photo or Aadhaar.
        disabled={uploading}
        onPress={submit}
      />
      {onBack ? <Button label="Back" variant="secondary" onPress={onBack} disabled={submitting} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md }
});
