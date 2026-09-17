import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { isCode, type Id, type IdProofSide, type PersonProfile } from "../../../api";
import { usePermissions } from "../../../auth/usePermissions";
import { Banner, Button, Card } from "../../../components/ui";
import { useImageCapture } from "../../../media";
import { colors, radii, spacing, typography } from "../../../theme";
import { formatDate, idProofLabel, idProofSummary } from "../../../utils/format";
import { useIdProofUrl, useRecaptureIdProofSide } from "../hooks";

/**
 * ID proof on file — the strictest data in the app (integration doc §9, spec §4.3).
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
export function IdProofPanel({
  person,
  onReplace
}: {
  person: PersonProfile;
  /** Opens the whole-document replace flow. Omitted in tests that don't exercise it. */
  onReplace?: () => void;
}) {
  const { canChangeIdProofType, canViewIdProof, canWrite } = usePermissions();

  // Held here rather than in each SideCard so a replace can collapse both at once — the
  // signed URLs behind them are removed from cache and their objects queued for deletion.
  const [revealed, setRevealed] = useState<Record<IdProofSide, boolean>>({
    FRONT: false,
    BACK: false
  });

  // A replaced document invalidates whatever is on screen. Collapse rather than refetch:
  // a refetch here would be an audit row the admin never asked for.
  useEffect(() => {
    setRevealed({ FRONT: false, BACK: false });
  }, [person.idProofType, person.idProofLast4]);

  return (
    <Card>
      <Text style={typography.eyebrow}>ID proof on file</Text>

      <Text
        style={typography.body}
        // "••••4567" is read out as four bullet glyphs by TalkBack and VoiceOver.
        accessibilityLabel={
          person.idProofLast4
            ? `${idProofLabel(person.idProofType)}, ending ${person.idProofLast4}`
            : idProofLabel(person.idProofType)
        }
      >
        {idProofSummary(person.idProofType, person.idProofLast4)}
      </Text>
      {person.idProofLast4 ? null : (
        <Text style={typography.bodySmall}>Last four characters not recorded.</Text>
      )}
      {/*
       * This is the *member record's* added-by/added-on, not the current image's.
       *
       * `PersonProfileResponse` has no capture attribution — api slice 4 reuses
       * created_by/created_at deliberately ("no separate capturer field"). So after a
       * collector re-captures, these values still name whoever created the member. It used
       * to read "Captured by Ishwar", which actively misattributed the image.
       *
       * Every re-capture *is* recorded server-side in `id_proof_access_log` with actor, side
       * and timestamp — a full replace logs `side = null`, meaning the whole document, and
       * the type is denormalised onto the row so the history survives a document swap. But
       * no endpoint exposes any of it, so it can't be shown here. Displaying "last captured
       * by X" needs the API to surface it (see 12-open-gaps.md).
       */}
      <Text style={typography.bodySmall}>
        Member added by {person.addedByName ?? "unknown"} · {formatDate(person.addedOn)}
      </Text>

      {!canViewIdProof ? (
        <Banner
          tone="notice"
          message={
            canWrite
              ? "ID proof is visible to the admin only. You can replace an unclear copy, but not open it."
              : "ID proof is visible to the admin only."
          }
        />
      ) : null}

      <SideCard
        personId={person.id}
        side="FRONT"
        canView={canViewIdProof}
        canWrite={canWrite}
        revealed={revealed.FRONT}
        onToggle={() => setRevealed((r) => ({ ...r, FRONT: !r.FRONT }))}
      />
      <SideCard
        personId={person.id}
        side="BACK"
        canView={canViewIdProof}
        canWrite={canWrite}
        revealed={revealed.BACK}
        onToggle={() => setRevealed((r) => ({ ...r, BACK: !r.BACK }))}
      />

      {canChangeIdProofType && onReplace ? (
        <View style={styles.replace}>
          <Button
            label="Change document type"
            variant="secondary"
            icon="swap-horizontal-outline"
            onPress={onReplace}
          />
          <Text style={typography.bodySmall}>
            Use this when the member presents a different document. Re-capture above just
            re-shoots the same one.
          </Text>
        </View>
      ) : canWrite ? (
        // A collector can re-shoot either side but cannot move the `type` — that is an
        // admin act now. Say what to do next: someone standing in front of a member holding
        // a new passport needs the escalation path, not silence.
        <View style={styles.replace}>
          <Text style={typography.bodySmall}>
            Presenting a different document? Ask an admin to change the document type.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function SideCard({
  personId,
  side,
  canView,
  canWrite,
  revealed,
  onToggle
}: {
  personId: Id;
  side: IdProofSide;
  canView: boolean;
  canWrite: boolean;
  revealed: boolean;
  onToggle: () => void;
}) {
  // Enabled only for an admin who has explicitly asked. Never prefetched.
  const signed = useIdProofUrl(personId, side, canView && revealed);
  const capture = useImageCapture(side === "FRONT" ? "ID_PROOF_FRONT" : "ID_PROOF_BACK");
  const update = useRecaptureIdProofSide(personId);

  // A finished upload is attached immediately — a re-capture is one action, not two.
  useEffect(() => {
    const key = capture.key;
    if (!key) return;
    capture.clear();
    // Collapse *before* the mutation settles. `removeQueries` on a still-enabled query
    // triggers an immediate refetch, and that refetch is a VIEW row nobody asked for.
    // This line is load-bearing, not cosmetic.
    if (revealed) onToggle();
    update.mutate({ side, key });
  }, [capture.key]);

  const label = side === "FRONT" ? "Front" : "Back";
  const missing = isCode(signed.error, "id_proof_missing");

  return (
    <View style={styles.side}>
      <Text style={typography.eyebrow}>{label}</Text>

      {canView && revealed ? (
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
        {canView ? (
          <View style={styles.action}>
            <Button
              label={revealed ? "Hide" : `View ${label.toLowerCase()}`}
              variant="secondary"
              icon={revealed ? "eye-off-outline" : "eye-outline"}
              onPress={onToggle}
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
  // Separated from the per-side actions above, because its scope is the whole document.
  replace: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  action: { flexGrow: 1, flexBasis: 130 }
});
