import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing, typography } from "../../theme";

type Props = {
  /** Small line under the association name. */
  eyebrow?: string;
  children: ReactNode;
};

/** Shared frame for every sign-in step: logo, association name, then the step's content. */
export function AuthShell({ eyebrow = "Committee sign-in", children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.masthead}>
          <Image
            source={require("../../../uploads/logo-1784996881407.jpeg")}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
          <Text style={typography.display}>Market Association Record</Text>
          <Text style={typography.bodySmall}>{eyebrow}</Text>
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
  panel: { gap: spacing.lg }
});
