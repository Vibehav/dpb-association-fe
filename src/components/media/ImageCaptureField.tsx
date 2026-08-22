import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { MediaType } from "../../api";
import type { ImageCapture } from "../../media";
import { colors, radii, spacing, typography } from "../../theme";
import { Button } from "../ui/Button";

type Props = {
  label: string;
  capture: ImageCapture;
  type: MediaType;
  /** Shown under the label — e.g. the Aadhaar visibility rule. */
  note?: string;
  /** Marks the field as required in the label. */
  required?: boolean;
};

/**
 * One image slot: preview, status, and the actions to capture or replace it.
 *
 * The states are deliberately distinct. An upload in flight shows a spinner over the
 * preview, and a failure shows the preview *plus* a retry — because the image is captured
 * but the key does not exist yet, and submitting would silently drop it.
 */
export function ImageCaptureField({ label, capture, type, note, required }: Props) {
  const { state, previewUri } = capture;
  const square = type === "PHOTO";

  return (
    <View style={styles.wrapper}>
      <Text style={typography.eyebrow}>
        {label}
        {required ? " ·  required" : ""}
      </Text>
      {note ? <Text style={typography.bodySmall}>{note}</Text> : null}

      <View style={[styles.frame, square ? styles.square : styles.card]}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons
              name={square ? "person-outline" : "id-card-outline"}
              size={28}
              color={colors.muted}
            />
          </View>
        )}

        {state.status === "uploading" ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.white} />
            <Text style={styles.overlayText}>Uploading…</Text>
          </View>
        ) : null}

        {state.status === "ready" ? (
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={13} color={colors.white} />
          </View>
        ) : null}
      </View>

      {state.status === "failed" ? <Text style={styles.error}>{state.message}</Text> : null}

      <View style={styles.actions}>
        {state.status === "failed" && previewUri ? (
          <View style={styles.action}>
            <Button label="Retry upload" variant="primary" icon="refresh" onPress={capture.retry} />
          </View>
        ) : null}

        <View style={styles.action}>
          <Button
            label={state.status === "ready" ? "Retake" : "Camera"}
            variant="secondary"
            icon="camera-outline"
            disabled={capture.busy}
            onPress={capture.captureFromCamera}
          />
        </View>
        <View style={styles.action}>
          <Button
            label="Choose"
            variant="secondary"
            icon="images-outline"
            disabled={capture.busy}
            onPress={capture.pickFromLibrary}
          />
        </View>
      </View>

      {state.status === "ready" ? (
        <Pressable onPress={capture.clear} hitSlop={6}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  frame: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.soft,
    alignSelf: "flex-start",
    position: "relative"
  },
  square: { width: 132, height: 132 },
  // Roughly an ID card, so the whole Aadhaar is visible in the preview.
  card: { width: 210, height: 132 },
  preview: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,22,19,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  overlayText: { ...typography.bodySmall, color: colors.white },
  badge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center"
  },
  error: { ...typography.bodySmall, color: colors.error },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  action: { flexGrow: 1, flexBasis: 120 },
  remove: { ...typography.bodySmall, color: colors.primary }
});
