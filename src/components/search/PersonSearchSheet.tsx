import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { peopleApi, type PersonListItem } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors, radii, spacing, typography } from "../../theme";
import { roleLabel } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { SearchBox } from "../ui/SearchBox";
import { Sheet } from "../ui/Sheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** One line explaining what picking a person will do. */
  hint?: string;
  onPickExisting: (person: PersonListItem) => void;
  /** Omit to hide the create affordance — e.g. when the caller can't create people. */
  onCreateNew?: () => void;
  /** People who can't be picked here, e.g. already linked to this shop. */
  excludeIds?: string[];
};

/**
 * **The duplicate guard.** Both "+ Add person to this shop" and "+ Add a member" open this,
 * never a blank form (integration doc §5.7, functional spec §7.3).
 *
 * At ~2,300 people this is the difference between one profile per worker and two
 * half-profiles with split histories. Nothing is listed until the user types — showing
 * everyone would defeat the point and pull the register onto the phone.
 *
 * Slight deviation from the design: it offers "Not on record — create new" as soon as a
 * search has been made, not only when there are zero results. Searching "Ramesh" and
 * getting three of them who are all the wrong Ramesh is a real case, and the user has
 * still been made to look first.
 */
export function PersonSearchSheet({
  visible,
  onClose,
  title,
  hint,
  onPickExisting,
  onCreateNew,
  excludeIds
}: Props) {
  const [term, setTerm] = useSearchTerm(visible);
  const debounced = useDebouncedValue(term.trim(), 350);
  const searching = debounced.length > 0;

  const results = useQuery({
    queryKey: queryKeys.people.list({ query: debounced }),
    queryFn: () => peopleApi.list({ query: debounced }),
    enabled: visible && searching
  });

  const excluded = new Set(excludeIds ?? []);
  const matches = (results.data?.content ?? []).filter((person) => !excluded.has(person.id));
  const hiddenCount = (results.data?.content.length ?? 0) - matches.length;

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {hint ? <Text style={typography.body}>{hint}</Text> : null}

      <SearchBox
        value={term}
        onChangeText={setTerm}
        placeholder="Search name, phone or shop number"
        autoFocus
      />

      <View style={styles.results}>
        {!searching ? (
          <Text style={styles.prompt}>Type a name or number to look for an existing member.</Text>
        ) : results.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : results.error ? (
          <ErrorState error={results.error} onRetry={results.refetch} />
        ) : matches.length === 0 ? (
          <Text style={styles.prompt}>
            No one on record matches “{debounced}”.
            {hiddenCount > 0 ? " Any match is already linked here." : ""}
          </Text>
        ) : (
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {matches.map((person) => (
              <PersonRow key={person.id} person={person} onPress={() => onPickExisting(person)} />
            ))}
          </ScrollView>
        )}
      </View>

      {onCreateNew && searching ? (
        <Button
          label="Not on record — create new"
          variant={matches.length === 0 ? "primary" : "secondary"}
          icon="person-add-outline"
          onPress={onCreateNew}
        />
      ) : null}

      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

function PersonRow({ person, onPress }: { person: PersonListItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Link ${person.name}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Avatar name={person.name} size={34} />
      <View style={styles.rowText}>
        <Text style={typography.cardTitle}>{person.name}</Text>
        <Text style={styles.mono}>{formatPhone(person.phone)}</Text>
        {/* Existing shops and roles are what tell the collector "this is the right man". */}
        {person.shops.length > 0 ? (
          <Text style={typography.bodySmall} numberOfLines={2}>
            {person.shops.map((shop) => `${shop.shopNumber} · ${roleLabel(shop.role)}`).join("   ")}
          </Text>
        ) : (
          <Text style={typography.bodySmall}>No shop linked</Text>
        )}
      </View>
    </Pressable>
  );
}

/** Clear the term when the sheet closes, so reopening doesn't reuse a stale search. */
function useSearchTerm(visible: boolean) {
  const [term, setTerm] = useState("");
  useEffect(() => {
    if (!visible) setTerm("");
  }, [visible]);
  return [term, setTerm] as const;
}

const styles = StyleSheet.create({
  results: { minHeight: 90, maxHeight: 300 },
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
  rowText: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 12 }
});
