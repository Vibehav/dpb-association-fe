import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { Card, ErrorState, Screen } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { MainTabsParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { usePeopleCount, useShopCount } from "./useCounts";

/**
 * Home, kept deliberately light.
 *
 * v1 has no dashboard or money data (integration doc §5.1), so this is two counts and
 * two shortcuts. The previous version rendered a general-fund balance, event cards and a
 * pending-collections list from `mockData.ts` — all v2, all invented figures presented as
 * though they were real.
 */
export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const shops = useShopCount();
  const people = usePeopleCount();

  useRefreshOnFocus(() => {
    shops.refetch();
    people.refetch();
  });

  const error = shops.error ?? people.error;
  const refreshing = shops.isFetching || people.isFetching;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        shops.refetch();
        people.refetch();
      }}
    >
      {error ? (
        <ErrorState
          error={error}
          title="Couldn't load the register"
          onRetry={() => {
            shops.refetch();
            people.refetch();
          }}
        />
      ) : (
        <>
          <View style={styles.row}>
            <CountCard
              label="Shops on record"
              value={shops.data}
              icon="storefront-outline"
              onPress={() => navigation.navigate("Shops")}
            />
            <CountCard
              label="People on record"
              value={people.data}
              icon="people-outline"
              onPress={() => navigation.navigate("People")}
            />
          </View>

          <Card>
            <Text style={typography.eyebrow}>Register</Text>
            <Text style={typography.body}>
              Shops and members, who holds each licence, who rents, and who works there.
              Money — contributions, receipts, funds and events — arrives in a later
              version.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

function CountCard({
  label,
  value,
  icon,
  onPress
}: {
  label: string;
  value: number | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Card style={styles.countCard} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.countValue}>{value === undefined ? "—" : value.toLocaleString("en-IN")}</Text>
      <Text style={typography.eyebrow}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  countCard: { flex: 1, gap: spacing.sm },
  countValue: { ...typography.display, fontSize: 30 }
});
