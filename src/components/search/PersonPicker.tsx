import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { type Id, peopleApi, type PersonListItem } from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors, spacing, typography } from "../../theme";
import { ErrorState } from "../ui/ErrorState";
import { Button } from "../ui/Button";
import { SearchBox } from "../ui/SearchBox";
import { PersonResultRow } from "./PersonResultRow";

type Props = {
  onPick: (person: PersonListItem) => void;
  excludeIds?: Id[];
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * When given, a search that finds nobody offers to add the person instead — search first,
   * create only when they are genuinely not on record (spec §7.3). Called with the search term in
   * capitals, the way names are recorded.
   */
  onNotFound?: (term: string) => void;
};

/**
 * Inline person search — **not** a sheet.
 *
 * The register-shop screen reveals this in place when the licence holder is an existing
 * member (prototype `showHolderPicker`), rather than covering the form with a modal. The
 * shop fields stay visible above it, which is the point.
 */
export function PersonPicker({ onPick, excludeIds, placeholder, autoFocus, onNotFound }: Props) {
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 350);
  const searching = debounced.length > 0;

  const results = useQuery({
    queryKey: queryKeys.people.list({ query: debounced }),
    queryFn: () => peopleApi.list({ query: debounced }),
    enabled: searching
  });

  const excluded = new Set(excludeIds ?? []);
  const matches = (results.data?.content ?? []).filter((person) => !excluded.has(person.id));

  return (
    <View style={styles.wrapper}>
      <SearchBox
        uppercase
        value={term}
        onChangeText={setTerm}
        placeholder={placeholder ?? "Search existing members"}
        autoFocus={autoFocus}
      />

      {!searching ? (
        <Text style={styles.prompt}>Search by name or phone number.</Text>
      ) : results.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={results.refetch} />
      ) : matches.length === 0 ? (
        <>
          <Text style={styles.prompt}>No one on record matches “{debounced}”.</Text>
          {onNotFound ? (
            <Button
              label={`Add “${debounced.toUpperCase()}” as a new person`}
              variant="secondary"
              icon="person-add-outline"
              onPress={() => onNotFound(debounced.toUpperCase())}
            />
          ) : null}
        </>
      ) : (
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {matches.map((person) => (
            <PersonResultRow
              key={person.id}
              person={person}
              action="Select"
              onPress={() => onPick(person)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  scroll: { maxHeight: 260, flexGrow: 0 },
  spinner: { paddingVertical: spacing.lg },
  prompt: { ...typography.bodySmall, paddingVertical: spacing.md }
});
