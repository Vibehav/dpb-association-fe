import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme";

type Props = {
  children: ReactNode;
  /** Wrap the content in a ScrollView. Off for screens that own a FlatList. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  edges?: Edge[];
};

/** The standard screen frame: safe-area padding, paper background, gutters. */
/**
 * Never the top edge by default.
 *
 * Every screen using this sits under something that already handles the status-bar inset —
 * a native-stack header, or `AppHeader` on the tabs. Applying the top inset again added a
 * second ~30dp of padding, which showed up as a conspicuous gap between the header and the
 * first card.
 */
const DEFAULT_EDGES: Edge[] = ["bottom", "left", "right"];

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  edges = DEFAULT_EDGES
}: Props) {
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {/* The member form is eight fields deep; without this the keyboard sits on top of the
          lower ones. Android resizes the window itself, so only iOS needs padding. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { padding: spacing.screen, gap: spacing.md, flex: 1 }
});
