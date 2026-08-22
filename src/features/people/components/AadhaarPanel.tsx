import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { isCode, type AadhaarSide, type PersonProfile } from "../../../api";
import { usePermissions } from "../../../auth/usePermissions";
import { Banner, Button, Card } from "../../../components/ui";
import { useImageCapture } from "../../../media";
import { colors, radii, spacing, typography } from "../../../theme";
import { formatDate } from "../../../utils/format";
import { useAadhaarUrl, useUpdateAadhaar } from "../hooks";

/**
 * Aadhaar on file — the strictest data in the app (integration doc §9, spec §4.3).
 *
 * - **Admin**: can open a stored image. Every view is logged server-side against them.
 * - **Collector**: may re-capture an unclear copy but can **never** view one. The endpoint
 *   is not called at all for them — not called-and-403-handled. Calling it would be a
 *   pointless request against a rule the whole feature exists to enforce.
 * - **Viewer**: neither.
 *
 * The design shows a blurred image for non-admins. There is nothing to blur here because
 * the bytes are never fetched, so it renders as an explicit locked placeholder instead —
 * which is the same intent, more honestly.
 */
export function AadhaarPanel({ person }: { person: PersonProfile }) {
  const { isAdmin, canWrite } = usePermissions();

  return (
    <Card>
      <Text style={typography.eyebrow}>Aadhaar on file</Text>

      <Text style={typography.body}>
        {person.aadhaarLast4
          ? `Ends in ${person.aadhaarLast4}`
          : "Last four digits not recorded."}
      </Text>
      <Text style={typography.bodySmall}>
        Captured by {person.addedByName ?? "unknown"} · {formatDate(person.addedOn)}
      </Text>

      {!isAdmin ? (
        <Banner
          tone="notice"
          message={
            canWrite
              ? "Aadhaar images are visible to the admin only. You can replace an unclear copy, but not open it."
              : "Aadhaar images are visible to the admin only."
          }
        />
      ) : null}

      <SideCard personId={person.id} side="FRONT" isAdmin={isAdmin} canWrite={canWrite} />
      <SideCard personId={person.id} side="BACK" isAdmin={isAdmin} canWrite={canWrite} />
    </Card>
  );
}

function SideCard({
  personId,
  side,
  isAdmin,
  canWrite
}: {
  personId: string;
  side: AadhaarSide;
  isAdmin: boolean;
  canWrite: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  // Enabled only for an admin who has explicitly asked. Never prefetched.
  const signed = useAadhaarUrl(personId, side, isAdmin && revealed);
  const capture = useImageCapture(side === "FRONT" ? "AADHAAR_FRONT" : "AADHAAR_BACK");
  const update = useUpdateAadhaar(personId);

  // A finished upload is attached immediately — a re-capture is one action, not two.
  useEffect(() => {
    const key = capture.key;
    if (!key) return;
    capture.clear();
    update.mutate({ side, key });
    setRevealed(false);
  }, [capture.key]);

  const label = side === "FRONT" ? "Front" : "Back";
  const missing = isCode(signed.error, "aadhaar_missing");

  return (
    <View style={styles.side}>
      <Text style={typography.eyebrow}>{label}</Text>

      {isAdmin && revealed ? (
        signed.isPending ? (
          <View style={styles.frame}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : missing ? (
          <Text style={typography.bodySmall}>
            The {label.toLowerCase()} was never captured.
          </Text>
        ) : signed.error ? (
          <Banner message="Couldn't open the image." />
        ) : signed.data ? (
          <Image source={{ uri: signed.data.url }} style={styles.frame} resizeMode="contain" />
        ) : null
      ) : (
        <View style={[styles.frame, styles.locked]}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.muted} />
        </View>
      )}

      <View style={styles.actions}>
        {isAdmin ? (
          <View style={styles.action}>
            <Button
              label={revealed ? "Hide" : `View ${label.toLowerCase()}`}
              variant="secondary"
              icon={revealed ? "eye-off-outline" : "eye-outline"}
              onPress={() => setRevealed(!revealed)}
            />
          </View>
        ) : null}

        {canWrite ? (
          <View style={styles.action}>
            <Button
              label={capture.busy || update.isPending ? "Saving…" : "Re-capture"}
              variant="secondary"
              icon="camera-outline"
              disabled={capture.busy || update.isPending}
              onPress={capture.captureFromCamera}
            />
          </View>
        ) : null}
      </View>

      {capture.state.status === "failed" ? <Banner message={capture.state.message} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  side: { gap: spacing.sm, paddingTop: spacing.md },
  frame: {
    width: "100%",
    height: 150,
    borderRadius: radii.md,
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  locked: { gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  action: { flexGrow: 1, flexBasis: 130 }
});
