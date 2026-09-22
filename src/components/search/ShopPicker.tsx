import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { type Id, shopsApi, type ShopListItem } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors, radii, spacing, typography } from "../../theme";
import { BusinessName } from "../ui/BusinessName";
import { ErrorState } from "../ui/ErrorState";
import { SearchBox } from "../ui/SearchBox";

type Props = {
  onPick: (shop: ShopListItem) => void;
  /** Shops already linked — hidden so a duplicate link can't be attempted. */
  excludeShopIds?: Id[];
  autoFocus?: boolean;
};

/**
 * Inline shop search — **not** a sheet.
 *
 * Used inside the member form's "Linked shop" section (prototype `isAddPerson`), where the
 * search sits in the form itself rather than covering it.
 */
export function ShopPicker({ onPick, excludeShopIds, autoFocus }: Props) {
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 350);
  const searching = debounced.length > 0;

  const results = useQuery({
    queryKey: queryKeys.shops.list({ query: debounced }),
    queryFn: () => shopsApi.list({ query: debounced }),
    enabled: searching
  });

  const excluded = new Set(excludeShopIds ?? []);
  const matches = (results.data?.content ?? []).filter((shop) => !excluded.has(shop.id));

  return (
    <View style={styles.wrapper}>
      <SearchBox
        value={term}
        onChangeText={setTerm}
        placeholder="Search shop no. or business name"
        autoFocus={autoFocus}
      />

      {!searching ? null : results.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={results.refetch} />
      ) : matches.length === 0 ? (
        <Text style={styles.prompt}>
          No shop matches “{debounced}”
          {excluded.size > 0 ? ", or it's already linked." : "."}
        </Text>
      ) : (
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {matches.map((shop) => (
            <Pressable
              key={shop.id}
              onPress={() => {
                setTerm("");
                onPick(shop);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Link ${shop.shopNumber}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.number}>{shop.shopNumber}</Text>
              <View style={styles.text}>
                <BusinessName businessName={shop.businessName} style={typography.cardTitle} />
                <Text style={typography.bodySmall}>{shop.lane}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  scroll: { maxHeight: 210, flexGrow: 0 },
  spinner: { paddingVertical: spacing.lg },
  prompt: { ...typography.bodySmall, paddingVertical: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md
  },
  pressed: { backgroundColor: colors.soft },
  number: { ...typography.mono, fontSize: 14, minWidth: 62 },
  text: { flex: 1, gap: 2 }
});
