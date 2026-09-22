import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePermissions } from "../../auth/usePermissions";
import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  ListFooter,
  SearchBox
} from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { countLine } from "../../utils/format";
import { ShopCard } from "./components/ShopCard";
import { useShopsList } from "./hooks";

const ALL = "__all__";

/**
 * The shops register (integration doc §5.2).
 *
 * Search and pagination are both server-side — at ~1,000 shops the full list must never
 * reach the phone. The count line reads `totalElements`, not the number of loaded rows,
 * so "6 of 1,024 shops shown" is honest about what you're looking at.
 */
export function ShopsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { canWrite } = usePermissions();

  const [term, setTerm] = useState("");
  const [lane, setLane] = useState<string>(ALL);
  const debounced = useDebouncedValue(term.trim(), 350);

  const list = useShopsList({
    query: debounced || undefined,
    lane: lane === ALL ? undefined : lane
  });

  useRefreshOnFocus(list.refetch);

  const pages = list.data?.pages ?? [];
  const shops = pages.flatMap((page) => page.content);
  const total = pages[0]?.totalElements ?? 0;

  // There is no lanes endpoint — `lane` is free text with no master table (api slice 1).
  // Chips are derived from what's been loaded, so they grow as you scroll.
  const lanes = useMemo(() => {
    const seen = new Set<string>();
    for (const shop of shops) if (shop.lane) seen.add(shop.lane);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [shops]);

  if (list.error && shops.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ErrorState error={list.error} title="Couldn't load shops" onRetry={list.refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={shops}
        keyExtractor={(shop) => String(shop.id)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshing={list.isRefetching}
        onRefresh={list.refetch}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchBox
              value={term}
              onChangeText={setTerm}
              placeholder="Search shop, business or person"
            />
            {lanes.length > 0 ? (
              <ChipRow>
                <Chip label="All" selected={lane === ALL} onPress={() => setLane(ALL)} />
                {lanes.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    selected={lane === value}
                    onPress={() => setLane(value)}
                  />
                ))}
              </ChipRow>
            ) : null}
            {!list.isPending ? (
              <Text style={typography.bodySmall}>{countLine(shops.length, total, "shop")}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ShopCard shop={item} onPress={() => navigation.navigate("ShopDetail", { shopId: item.id })} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          list.isPending ? null : (
            <EmptyState
              icon="storefront-outline"
              title={debounced || lane !== ALL ? "No shops match" : "No shops yet"}
              message={
                debounced || lane !== ALL
                  ? "Try a different number, business name or person."
                  : "Register the first shop to start the register."
              }
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={list.isFetchingNextPage}
            hasMore={Boolean(list.hasNextPage)}
            error={list.error && shops.length > 0 ? list.error : undefined}
            onRetry={list.fetchNextPage}
            endLabel={total > 0 ? `All ${total.toLocaleString("en-IN")} shown` : undefined}
          />
        }
      />

      {/* Sticky rather than at the end of the list: at 1,000 shops you'd never scroll to it. */}
      {canWrite ? (
        <View style={styles.actionBar}>
          <Button
            label="Register new shop"
            icon="add"
            onPress={() => navigation.navigate("ShopForm", {})}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.screen, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.sm, paddingBottom: spacing.xs },
  separator: { height: spacing.md },
  actionBar: {
    padding: spacing.screen,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  }
});
