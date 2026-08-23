import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ASSOCIATION_NAME } from "../../config";
import { colors, radii, spacing, typography } from "../../theme";

type Props = {
  children: ReactNode;
};

/**
 * Shared frame for every sign-in step: logo, association name, "Committee sign-in".
 *
 * The subtitle is **fixed**. An earlier version let each step override it, so the PIN screen
 * read "Welcome back, Ishwar" where the design keeps "Committee sign-in" throughout. Greeting
 * the member by name belongs on the phone step, next to the number they just typed
 * (prototype `authGreeting`), which is where it confirms they typed the right one.
 */
export function AuthShell({ children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.masthead}>
          <Image
            source={require("../../../uploads/logo-1784996881407.jpeg")}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.assocName}>{ASSOCIATION_NAME}</Text>
          <Text style={typography.bodySmall}>Committee sign-in</Text>
        </View>
        <View style={styles.panel}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, padding: spacing.xxl, gap: spacing.xl },
  masthead: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.xxl },
  logo: { width: 64, height: 64, borderRadius: radii.pill },
  // Larger than `typography.display` and centred, because it wraps to two lines.
  assocName: { ...typography.display, fontSize: 28, lineHeight: 34, textAlign: "center" },
  panel: { gap: spacing.lg }
});
