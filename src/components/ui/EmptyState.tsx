import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme";

type Props = {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

/** "Nothing here" — distinct from ErrorState, which means "we couldn't find out". */
export function EmptyState({ title, message, icon = "file-tray-outline" }: Props) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name={icon} size={30} color={colors.muted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl },
  title: { ...typography.cardTitle, textAlign: "center" },
  message: { ...typography.body, textAlign: "center", paddingHorizontal: spacing.lg }
});
