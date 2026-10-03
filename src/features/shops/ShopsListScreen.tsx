import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePermissions } from "../../auth/usePermissions";
import { SearchWithFilters, type FilterValues } from "../../components/search/SearchWithFilters";
import { Button, EmptyState, ErrorState, ListFooter } from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList, MainTabsParamList, ShopFeeFilter } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { countLine } from "../../utils/format";
import { ShopCard } from "./components/ShopCard";
import { useShopsList } from "./hooks";

/** Fee filters, server-side (v2 Phase 1). Home's pending lists open this tab with one set. */
const FEE_FILTERS: { value: ShopFeeFilter; label: string }[] = [
  { value: "PENDING", label: "Due" },
  { value: "PARTIAL", label: "Part paid" },
  { value: "PAID", label: "Fee paid" },
  { value: "ARREARS", label: "Arrears" }
];

/**
 * The shops register (integration doc §5.2).
 *
 * Search and pagination are both server-side — at ~1,000 shops the full list must never
 * reach the phone. The count line reads `totalElements`, not the number of loaded rows,
 * so "6 of 1,024 shops shown" is honest about what you're looking at.
 */
export function ShopsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<MainTabsParamList, "Shops">>();
  const { canWrite } = usePermissions();

  const [term, setTerm] = useState("");
  const [lane, setLane] = useState<string | null>(null);
  const [fee, setFee] = useState<ShopFeeFilter | null>(route.params?.feeFilter ?? null);
  const debounced = useDebouncedValue(term.trim(), 350);

  // Arriving from Home's "View all" sets the filter, even when the tab was already mounted.
  useEffect(() => {
    if (route.params?.feeFilter) setFee(route.params.feeFilter);
  }, [route.params?.feeFilter]);

  const list = useShopsList({
    query: debounced || undefined,
    lane: lane ?? undefined,
    feeStatus: fee && fee !== "ARREARS" ? fee : undefined,
    arrears: fee === "ARREARS" ? true : undefined
  });

  useRefreshOnFocus(list.refetch);

  const pages = list.data?.pages ?? [];
  const shops = pages.flatMap((page) => page.content);
  const total = pages[0]?.totalElements ?? 0;

  // There is no lanes endpoint — `lane` is free text with no master table (api slice 1).
  // The choices are every lane seen so far, so they grow as you scroll — and are remembered,
  // so applying one lane doesn't shrink the list of lanes to that one.
  const seenLanes = useRef(new Set<string>());
  const lanes = useMemo(() => {
    for (const shop of shops) if (shop.lane) seenLanes.current.add(shop.lane);
    return [...seenLanes.current].sort((a, b) => a.localeCompare(b));
  }, [shops]);

  const filterSections = [
    {
      key: "fee",
      title: "Fee this year",
      anyLabel: "Any",
      options: FEE_FILTERS.map(({ value, label }) => ({ value, label }))
    },
    ...(lanes.length > 0
      ? [{ key: "lane", title: "Lane", anyLabel: "All lanes", options: lanes.map((value) => ({ value, label: value })) }]
      : [])
  ];
  const filterValues: FilterValues = { fee, lane };
  function applyFilters(next: FilterValues) {
    setFee((next.fee as ShopFeeFilter | null) ?? null);
    setLane(next.lane ?? null);
  }

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
            <SearchWithFilters
              term={term}
              onChangeTerm={setTerm}
              placeholder="Search shop, business or person"
              sections={filterSections}
              values={filterValues}
              onChangeValues={applyFilters}
            />
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
              title={debounced || lane !== null || fee ? "No shops match" : "No shops yet"}
              message={
                fee && !debounced && lane === null
                  ? "No shop is in that fee position right now."
                  : debounced || lane !== null
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
