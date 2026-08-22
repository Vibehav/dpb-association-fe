/**
 * DEV ONLY — a harness for the phase 4 media pipeline.
 *
 * Proves the full round trip on a real device: capture → compress → presigned PUT →
 * key → attach to a person → signed GET → render the bytes back. Registered only under
 * `__DEV__`; delete this folder once the phase 6 member form covers the same ground.
 *
 * It writes to whichever person `GET /people?size=1` returns first, i.e. your dev seed
 * data. Don't point it at anything you care about.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { errorMessage, peopleApi, type AadhaarSide } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { usePermissions } from "../../auth/usePermissions";
import { ImageCaptureField } from "../../components/media/ImageCaptureField";
import { Banner, Button, Card, ErrorState, LoadingScreen, Screen } from "../../components/ui";
import { useImageCapture } from "../../media";
import { colors, spacing, typography } from "../../theme";

export function MediaCheckScreen() {
  const { isAdmin } = usePermissions();
  const target = useQuery({
    queryKey: queryKeys.people.list({ size: 1 }),
    queryFn: () => peopleApi.list({ size: 1 }),
    select: (page) => page.content[0] ?? null
  });

  const photo = useImageCapture("PHOTO");
  const aadhaarFront = useImageCapture("AADHAAR_FRONT");

  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [aadhaarUrl, setAadhaarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (target.isPending) return <LoadingScreen />;
  if (target.error) return <Screen><ErrorState error={target.error} onRetry={target.refetch} /></Screen>;
  if (!target.data) {
    return (
      <Screen>
        <Banner tone="notice" message="No people in the register yet — load the seed data first." />
      </Screen>
    );
  }

  const person = target.data;

  async function savePhoto(key: string) {
    setSaving(true);
    setMessage(null);
    setSavedUrl(null);
    try {
      await peopleApi.updatePhoto(person.id, key);
      const signed = await peopleApi.photoUrl(person.id);
      setSavedUrl(signed.url);
      setMessage(`Photo saved and read back (URL valid ${signed.expiresInSeconds}s).`);
    } catch (caught) {
      setMessage(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function saveAadhaar(key: string, side: AadhaarSide) {
    setSaving(true);
    setMessage(null);
    setAadhaarUrl(null);
    try {
      await peopleApi.updateAadhaar(person.id, side, key);
      if (!isAdmin) {
        // Deliberately not fetched: a non-admin gets 403, and the rule is not to call it
        // at all (integration doc §9).
        setMessage("Aadhaar re-captured. Viewing it is admin-only, so it was not fetched.");
        return;
      }
      const signed = await peopleApi.aadhaarUrl(person.id, side);
      setAadhaarUrl(signed.url);
      setMessage(`Aadhaar ${side} saved and read back — this view is logged server-side.`);
    } catch (caught) {
      setMessage(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Banner tone="notice" message={`Dev harness. Writes to "${person.name}" in your seed data.`} />

      <Card>
        <ImageCaptureField label="Member photo" type="PHOTO" capture={photo} required />
        <Button
          label="Save as member photo"
          icon="cloud-upload-outline"
          loading={saving}
          disabled={!photo.key}
          onPress={() => photo.key && savePhoto(photo.key)}
        />
        {photo.key ? <Text style={styles.key}>key: {photo.key}</Text> : null}
        {savedUrl ? (
          <>
            <Text style={typography.eyebrow}>Read back from storage</Text>
            <Image source={{ uri: savedUrl }} style={styles.result} resizeMode="cover" />
          </>
        ) : null}
      </Card>

      <Card>
        <ImageCaptureField
          label="Aadhaar front"
          type="AADHAAR_FRONT"
          capture={aadhaarFront}
          required
          note={
            isAdmin
              ? "You are an admin, so the stored image can be opened — and every view is logged."
              : "Collectors can capture but never view a stored Aadhaar image."
          }
        />
        <Button
          label="Save Aadhaar front"
          icon="cloud-upload-outline"
          loading={saving}
          disabled={!aadhaarFront.key}
          onPress={() => aadhaarFront.key && saveAadhaar(aadhaarFront.key, "FRONT")}
        />
        {aadhaarFront.key ? <Text style={styles.key}>key: {aadhaarFront.key}</Text> : null}
        {aadhaarUrl ? (
          <>
            <Text style={typography.eyebrow}>Read back from storage (admin)</Text>
            <Image source={{ uri: aadhaarUrl }} style={styles.resultWide} resizeMode="cover" />
          </>
        ) : null}
      </Card>

      {message ? <Banner tone={message.includes("saved") ? "success" : "error"} message={message} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  key: { ...typography.monoSmall, color: colors.muted },
  result: { width: 132, height: 132, borderRadius: spacing.md },
  resultWide: { width: 210, height: 132, borderRadius: spacing.md }
});
