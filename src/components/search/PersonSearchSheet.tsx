import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { peopleApi, type PersonListItem } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors, spacing, typography } from "../../theme";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { SearchBox } from "../ui/SearchBox";
import { PersonResultRow } from "./PersonResultRow";
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

/** The design's own wording (prototype `showPickSheet`). */
const DEFAULT_HINT = "Search first — the person may already be on record at another shop.";

/**
 * **The duplicate guard.** Both "+ Add person to this shop" and "+ Add a member" open this,
 * never a blank form (prototype `showPickSheet`, integration doc §5.7, spec §7.3).
 *
 * At ~2,300 people this is the difference between one profile per worker and two
 * half-profiles with split histories. Nothing is listed until the user types — showing
 * everyone would defeat the point and pull the register onto the phone.
 *
 * **"Not on record — create new" is always visible**, beside Cancel, exactly as the design
 * has it. An earlier version only revealed it once you had typed something, which made the
 * sheet read as a dead end when you already knew the person wasn't registered.
 */
export function PersonSearchSheet({
  visible,
  onClose,
  title,
  hint = DEFAULT_HINT,
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

      <SearchBox value={term} onChangeText={setTerm} placeholder="Name or phone number" autoFocus />

      <View style={styles.results}>
        {!searching ? (
          <Text style={styles.prompt}>
            Type a name or number to check whether this person is already registered.
          </Text>
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
              <PersonResultRow
                key={person.id}
                person={person}
                action="Link"
                onPress={() => onPickExisting(person)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Cancel and create-new side by side, both always available — as the design has it. */}
      <View style={styles.footer}>
        <View style={styles.footerCancel}>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </View>
        {onCreateNew ? (
          <View style={styles.footerCreate}>
            <Button
              label="Not on record — create new"
              icon="person-add-outline"
              onPress={onCreateNew}
            />
          </View>
        ) : null}
      </View>
    </Sheet>
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
  footer: { flexDirection: "row", gap: spacing.sm },
  footerCancel: { flexBasis: 100, flexGrow: 0 },
  footerCreate: { flex: 1 }
});
