import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { type Id, LINKABLE_ROLES, shopsApi, type LinkableRole, type ShopListItem } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors, radii, spacing, typography } from "../../theme";
import { roleLabel } from "../../utils/format";
import { Banner } from "../ui/Banner";
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
  excludeShopIds?: Id[];
  onPick: (shop: ShopListItem, role: LinkableRole) => void;
  /** Server-side failure, shown in place so the sheet can stay open on it. */
  error?: string | null;
  /** Disables the list while the link is being saved. */
  busy?: boolean;
};

/**
 * Pick a shop and the role held there.
 *
 * Roles are **RENTER or STAFF only** — an OWNER link is created solely by shop registration
 * or a licence transfer (integration doc §5.7). Used when linking a member to another shop,
 * and when building the mandatory first link on a standalone add.
 */
export function ShopSearchSheet({
  visible,
  onClose,
  title,
  hint,
  excludeShopIds,
  onPick,
  error,
  busy
}: Props) {
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
            {matches.map((shop) => {
              // ≤1 renter per shop. `rentedToName` is already on the list item, so say so
              // up front rather than letting the user earn a 409 `renter_exists`.
              const renterTaken = role === "RENTER" && Boolean(shop.rentedToName);
              return (
                <Pressable
                  key={shop.id}
                  disabled={renterTaken || busy}
                  onPress={() => onPick(shop, role)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: renterTaken }}
                  accessibilityLabel={`Link ${shop.shopNumber} as ${roleLabel(role)}`}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && !renterTaken && styles.rowPressed,
                    renterTaken && styles.rowDisabled
                  ]}
                >
                  <Text style={styles.number}>{shop.shopNumber}</Text>
                  <View style={styles.rowText}>
                    <Text style={typography.cardTitle}>{shop.businessName}</Text>
                    <Text style={typography.bodySmall}>
                      {renterTaken
                        ? `Already rented to ${shop.rentedToName} — add as staff instead`
                        : shop.lane}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {error ? <Banner message={error} /> : null}

      <Button label="Cancel" variant="ghost" onPress={onClose} disabled={busy} />
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
  rowDisabled: { opacity: 0.45 },
  number: { ...typography.mono, fontSize: 14, minWidth: 62 },
  rowText: { flex: 1, gap: 2 }
});
