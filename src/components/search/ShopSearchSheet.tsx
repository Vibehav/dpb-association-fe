import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LINKABLE_ROLES, shopsApi, type LinkableRole, type ShopListItem } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors, radii, spacing, typography } from "../../theme";
import { roleLabel } from "../../utils/format";
import { Button } from "../ui/Button";
import { Chip, ChipRow } from "../ui/Chip";
import { ErrorState } from "../ui/ErrorState";
import { SearchBox } from "../ui/SearchBox";
import { Sheet } from "../ui/Sheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  /** Shops already linked — hidden so a duplicate link can't be attempted. */
  excludeShopIds?: string[];
  onPick: (shop: ShopListItem, role: LinkableRole) => void;
};

/**
 * Pick a shop and the role held there.
 *
 * Roles are **RENTER or STAFF only** — an OWNER link is created solely by shop registration
 * or a licence transfer (integration doc §5.7). Used when linking a member to another shop,
 * and when building the mandatory first link on a standalone add.
 */
export function ShopSearchSheet({ visible, onClose, title, hint, excludeShopIds, onPick }: Props) {
  const [term, setTerm] = useState("");
  const [role, setRole] = useState<LinkableRole>("STAFF");
  const debounced = useDebouncedValue(term.trim(), 350);
  const searching = debounced.length > 0;

  useEffect(() => {
    if (!visible) setTerm("");
  }, [visible]);

  const results = useQuery({
    queryKey: queryKeys.shops.list({ query: debounced }),
    queryFn: () => shopsApi.list({ query: debounced }),
    enabled: visible && searching
  });

  const excluded = new Set(excludeShopIds ?? []);
  const matches = (results.data?.content ?? []).filter((shop) => !excluded.has(shop.id));

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {hint ? <Text style={typography.body}>{hint}</Text> : null}

      <Text style={typography.eyebrow}>Their role at that shop</Text>
      <ChipRow>
        {LINKABLE_ROLES.map((value) => (
          <Chip
            key={value}
            label={roleLabel(value)}
            selected={role === value}
            onPress={() => setRole(value)}
          />
        ))}
      </ChipRow>

      <SearchBox
        value={term}
        onChangeText={setTerm}
        placeholder="Search shop number or business"
        autoFocus
      />

      <View style={styles.results}>
        {!searching ? (
          <Text style={styles.prompt}>Type a shop number or business name.</Text>
        ) : results.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : results.error ? (
          <ErrorState error={results.error} onRetry={results.refetch} />
        ) : matches.length === 0 ? (
          <Text style={styles.prompt}>
            No shop matches “{debounced}”
            {excluded.size > 0 ? ", or the match is already linked." : "."}
          </Text>
        ) : (
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {matches.map((shop) => (
              <Pressable
                key={shop.id}
                onPress={() => onPick(shop, role)}
                accessibilityRole="button"
                accessibilityLabel={`Link ${shop.shopNumber} as ${roleLabel(role)}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.number}>{shop.shopNumber}</Text>
                <View style={styles.rowText}>
                  <Text style={typography.cardTitle}>{shop.businessName}</Text>
                  <Text style={typography.bodySmall}>
                    {shop.lane}
                    {shop.rentedToName ? ` · rented to ${shop.rentedToName}` : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  results: { minHeight: 90, maxHeight: 260 },
  scroll: { flexGrow: 0 },
  spinner: { paddingVertical: spacing.xl },
  prompt: { ...typography.bodySmall, paddingVertical: spacing.lg, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md
  },
  rowPressed: { backgroundColor: colors.soft },
  number: { ...typography.mono, fontSize: 14, minWidth: 62 },
  rowText: { flex: 1, gap: 2 }
});
