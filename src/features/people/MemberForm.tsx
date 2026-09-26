/**
 * The member fields — name, photo, contact, address, ID proof, consent.
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
import { ID_PROOF_TYPES, peopleApi, type IdProofType, type NewPersonPayload } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useMe } from "../../auth/useMe";
import { ImageCaptureField } from "../../components/media/ImageCaptureField";
import {
  Banner,
  Button,
  Card,
  CheckRow,
  Chip,
  ChipRow,
  ConfirmSheet,
  Field,
  PhoneField
} from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { imageFieldError, useImageCapture } from "../../media";
import { spacing, typography } from "../../theme";
import { formatDate, idProofLabel } from "../../utils/format";
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
  /**
   * Whether the member is present to be photographed. Optional since client revision v3, for
   * the same reason the ID proof is: the register loads from records with no images, and a
   * collector recording someone who is not in front of them has nothing to photograph.
   *
   * **Independent of {@link hasIdProof}.** Skipping one says nothing about the other — a
   * member may carry either image, both, or neither. Hides rather than clears, as below.
   */
  const [hasPhoto, setHasPhoto] = useState(true);
  /**
   * Whether the member has their document to hand. Optional since client revision v2 — the
   * register is loaded from records that carry no ID proofs, and a collector standing in
   * front of someone who left their Aadhaar at home should be able to enrol them anyway.
   *
   * Turning it off **hides** the section rather than clearing it: a capture already taken is
   * kept in case the toggle was a mis-tap, and simply left out of the payload. Nothing is
   * destroyed, so nothing needs confirming.
   */
  const [hasIdProof, setHasIdProof] = useState(true);
  const [idProofType, setIdProofType] = useState<IdProofType>("AADHAAR");
  // Set while a type change is waiting on confirmation, because captures would be lost.
  const [pendingType, setPendingType] = useState<IdProofType | null>(null);
  const [idProofLast4, setIdProofLast4] = useState("");
  const [consent, setConsent] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const photo = useImageCapture("PHOTO");
  const idProofFront = useImageCapture("ID_PROOF_FRONT");
  const idProofBack = useImageCapture("ID_PROOF_BACK");

  // Live duplicate-phone warning while typing (spec §7.2). The server is authoritative and
  // answers 409, but telling the collector before they fill the rest of the form saves a
  // wasted photo and ID-proof capture.
  const debouncedPhone = useDebouncedValue(normalisePhone(phone), 400);
  const duplicate = useQuery({
    queryKey: queryKeys.people.list({ query: debouncedPhone }),
    queryFn: () => peopleApi.list({ query: debouncedPhone }),
    enabled: isValidPhone(debouncedPhone),
    select: (page) => page.content.find((person) => person.phone === debouncedPhone) ?? null
  });

  const uploading = photo.busy || idProofFront.busy || idProofBack.busy;

  /**
   * `idProofType` is the only record of *what* the stored image is, and the API cannot tell
   * an Aadhaar from a passport — both land under the same storage prefix. Carrying a
   * capture across a type change would mislabel it permanently and invisibly: only an admin
   * can ever open the image, and they have no reason to audit a field that looks filled in.
   *
   * So a type change clears the captures. Silently deleting photographs someone just took
   * would read as a bug, so it is confirmed — but only once there is something to lose.
   */
  function changeIdProofType(next: IdProofType) {
    if (next === idProofType) return;
    // `previewUri`, not `key`: a capture that is mid-upload or failed has no key yet, but
    // it is on screen and the collector would be surprised to lose it without being asked.
    if (idProofFront.previewUri || idProofBack.previewUri) {
      setPendingType(next);
      return;
    }
    applyIdProofType(next);
  }

  function applyIdProofType(next: IdProofType) {
    idProofFront.clear();
    idProofBack.clear();
    // An Aadhaar's last four is meaningless on a passport, and the field relabels itself.
    setIdProofLast4("");
    setIdProofType(next);
    setPendingType(null);
    // A cleared capture leaves an uploaded object nothing will ever reference. That is
    // already true of every retake, and the key is opaque in a private bucket — harmless.
  }

  function submit() {
    // Validation order is the one the spec asks for, surfacing one plain message at a time
    // (§7.2): name → phone → at least one shop with a role → photo → ID-proof front → consent.
    const message = firstError(
      validateName(name),
      validatePhone(phone),
      sameWhatsApp ? null : validateWhatsApp(whatsApp),
      validateLinks ? validateLinks() : null,
      hasIdProof ? validateIdProofLast4(idProofLast4) : null,
      // State-aware: distinguishes "not captured yet" from "captured but the upload
      // failed". The API now rejects a key whose object never landed in storage.
      hasPhoto ? imageFieldError(photo, "The member photo") : null,
      // The photo and consent stay mandatory; only the document may be skipped.
      hasIdProof
        ? imageFieldError(idProofFront, `The ${idProofLabel(idProofType).toLowerCase()} front`)
        : null,
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
      // Non-null by the time validation passes, and omitted entirely when skipped — the API
      // takes an absent key as "photograph them later", and "" as a 400.
      ...(hasPhoto ? { photoKey: photo.key as string } : {}),
      // All four ID-proof fields move together or not at all — the API rejects any half
      // state with a 400 naming `idProofConsistent`, and a back key or a last-four with no
      // document behind it is exactly that. Skipping enrols a *pending* member.
      ...(hasIdProof
        ? {
            idProofType,
            idProofFrontKey: idProofFront.key as string,
            ...(idProofBack.key ? { idProofBackKey: idProofBack.key } : {}),
            // Spread, never `idProofLast4: last4 || undefined`. The API's @Pattern on this
            // field has no @NotBlank beside it, so "" is a 400 while an absent key is fine.
            ...(last4 ? { idProofLast4: last4 } : {})
          }
        : {}),
      consent: true
    });
  }

  return (
    <View style={styles.stack}>
      <Card>
        <Field
          label="Full name"
          placeholder="As written on the ID proof"
          value={name}
          onChangeText={setName}
          uppercase
        />
        <CheckRow
          label="The member is here to be photographed"
          checked={hasPhoto}
          onToggle={setHasPhoto}
          description="Turn this off to enrol them now and take the photo later."
        />
        {hasPhoto ? (
          <ImageCaptureField label="Member photo" type="PHOTO" capture={photo} required />
        ) : (
          <Banner
            tone="notice"
            message="This member will be saved without a photo and will appear in the photoless list. Any admin or collector can take it later from their profile."
          />
        )}
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
        <Text style={typography.eyebrow}>ID proof</Text>
        <CheckRow
          label="The member has their ID proof with them"
          checked={hasIdProof}
          onToggle={setHasIdProof}
          description="Turn this off to enrol them now and capture the document later."
        />

        {!hasIdProof ? (
          <Banner
            tone="notice"
            message="This member will be saved without an ID proof and will appear in the pending list. Any admin or collector can capture the document later from their profile."
          />
        ) : null}
      </Card>

      {/* Hidden rather than disabled when there is no document: a greyed-out camera invites
          a collector to hunt for why it will not open. */}
      {hasIdProof ? (
        <Card>
          {/* The picker comes first: it decides what the two slots below are photographing,
              and the collector has the document in hand before they raise the camera. */}
          <ChipRow>
            {ID_PROOF_TYPES.map((option) => (
              <Chip
                key={option}
                label={idProofLabel(option)}
                selected={idProofType === option}
                onPress={() => changeIdProofType(option)}
              />
            ))}
          </ChipRow>

          {/* Labels name the chosen type, so a wrong pick is visible at the moment of
              capture rather than buried in a chip row above. */}
          <ImageCaptureField
            label={`${idProofLabel(idProofType)} front`}
            type="ID_PROOF_FRONT"
            capture={idProofFront}
            required
            note="Stored encrypted. Once saved, the image can only be opened by the admin — collectors cannot view it again."
          />
          <ImageCaptureField
            label={`${idProofLabel(idProofType)} back`}
            type="ID_PROOF_BACK"
            capture={idProofBack}
          />
          <Field
            label={`${idProofLabel(idProofType)} — last 4 (optional)`}
            placeholder="1234"
            value={idProofLast4}
            // Letters as well as digits: a PAN's last four contain one. Stripped rather than
            // rejected so a typed space or dash never becomes an error message.
            //
            // No `keyboardType="number-pad"` — a number pad cannot type the F in 234F.
            onChangeText={(next) => setIdProofLast4(next.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))}
            autoCorrect={false}
            maxLength={4}
            uppercase
          />
        </Card>
      ) : null}

      <ConfirmSheet
        visible={pendingType !== null}
        onClose={() => setPendingType(null)}
        onConfirm={() => pendingType && applyIdProofType(pendingType)}
        title="Change document type?"
        message="The captured images and last-4 will be cleared and must be re-taken."
        confirmLabel="Change and start again"
        destructive
      />

      <Card>
        <CheckRow
          label="Consent"
          checked={consent}
          onToggle={setConsent}
          description="The member has agreed to the association keeping their ID proof copy and contact details on record."
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
        // saved without the mandatory photo or ID proof.
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
