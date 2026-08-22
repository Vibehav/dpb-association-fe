import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing, typography } from "../../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * Bottom sheet, built on RN's `Modal`.
 *
 * The design asks for sheets on destructive and multi-field actions. A gesture-driven
 * sheet library would pull in Reanimated and a native rebuild; this covers the same
 * ground for v1, and multi-field flows use modal stack screens instead. See the plan's
 * decision 0.6.
 */
export function Sheet({ visible, onClose, title, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <SafeAreaView edges={["bottom"]} style={styles.panelWrapper}>
          <View style={styles.panel}>
            <View style={styles.grabber} />
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(26,22,19,0.35)" },
  backdropFill: { ...StyleSheet.absoluteFillObject },
  panelWrapper: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  panel: { padding: spacing.xl, gap: spacing.md },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.xs
  },
  title: { ...typography.title }
});
