import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMe } from "../auth/useMe";
import { Avatar } from "../components/ui";
import { colors, spacing, typography } from "../theme";
import { titleCase } from "../utils/format";
import type { AppStackParamList } from "./types";

/**
 * The shared header: screen title on the left, the signed-in user's initials on the
 * right. Tapping the initials opens Account, which is not a tab (functional spec §5).
 *
 * The name and role come from `useMe()`, so a role change shows up here too.
 */
export function AppHeader({ title }: { title: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { data: me } = useMe();

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={typography.title}>{title}</Text>
          {me ? (
            <Text style={typography.bodySmall}>
              {me.name} · {titleCase(me.role)}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => navigation.navigate("Account")}
          accessibilityRole="button"
          accessibilityLabel="Open account"
          hitSlop={8}
        >
          <Avatar name={me?.name ?? "?"} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  titleBlock: { gap: 2 }
});
