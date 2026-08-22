import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { Banner, Button } from "../../../components/ui";
import { useImageCapture } from "../../../media";
import { colors, radii, spacing, typography } from "../../../theme";
import { useUpdatePhoto } from "../hooks";

type Props = {
  personId: string;
  /** Short-lived signed URL from the profile response — safe to use directly. */
  photoUrl: string | null;
  canRetake: boolean;
};

/**
 * The member photo, with retake (integration doc §5.8).
 *
 * A face photo so the person is identifiable at the counter, so it's shown large and
 * round. Retake captures, uploads, and attaches in one action.
 */
export function MemberPhoto({ personId, photoUrl, canRetake }: Props) {
  const capture = useImageCapture("PHOTO");
  const update = useUpdatePhoto(personId);

  useEffect(() => {
    const key = capture.key;
    if (!key) return;
    capture.clear();
    update.mutate(key);
  }, [capture.key]);

  const busy = capture.busy || update.isPending;
  // Show the freshly captured image immediately, before the profile refetches.
  const shown = capture.previewUri ?? photoUrl;

  return (
    <View style={styles.wrapper}>
      <View style={styles.frame}>
        {shown ? (
          <Image source={{ uri: shown }} style={styles.photo} resizeMode="cover" />
        ) : (
          <Ionicons name="person-outline" size={34} color={colors.muted} />
        )}
        {busy ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
      </View>

      {canRetake ? (
        <Button
          label={busy ? "Saving…" : "Retake"}
          variant="secondary"
          icon="camera-outline"
          disabled={busy}
          onPress={capture.captureFromCamera}
        />
      ) : null}

      {capture.state.status === "failed" ? <Banner message={capture.state.message} /> : null}
      {!photoUrl && !capture.previewUri ? (
        <Text style={typography.bodySmall}>No photo on file.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: spacing.sm },
  frame: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    overflow: "hidden",
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  photo: { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,22,19,0.5)",
    alignItems: "center",
    justifyContent: "center"
  }
});
