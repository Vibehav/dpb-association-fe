import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { peopleApi, type DonorListItem, type PersonListItem } from "../../../api";
import { queryKeys } from "../../../app/queryKeys";
import { PersonResultRow } from "../../../components/search/PersonResultRow";
import { Avatar, Button, ErrorState, SearchBox, Sheet } from "../../../components/ui";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { colors, spacing, typography } from "../../../theme";
import { formatPhone } from "../../../utils/phone";
import { useDonorSearch } from "../hooks";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickMember: (person: PersonListItem) => void;
  onPickDonor: (donor: DonorListItem) => void;
  /** "Not on record" — a new outside donor, entered on the collection form. */
  onNewDonor: () => void;
};

/**
 * Who is paying — members and outside donors searched together.
 *
 * Search-first, like the member duplicate guard: a sponsor who gives every year must be
 * picked, not added again, or their giving splits across two records. Nothing is listed
 * until the user types.
 */
export function PayerPickerSheet({ visible, onClose, onPickMember, onPickDonor, onNewDonor }: Props) {
  const [term, setTerm] = useState("");
  useEffect(() => {
    if (!visible) setTerm("");
  }, [visible]);
  const debounced = useDebouncedValue(term.trim(), 350);
  const searching = debounced.length > 0;

  const members = useQuery({
    queryKey: queryKeys.people.list({ query: debounced }),
    queryFn: () => peopleApi.list({ query: debounced }),
    enabled: visible && searching
  });
  const donors = useDonorSearch(debounced, visible);

  const memberRows = members.data?.content ?? [];
  const donorRows = donors.data?.content ?? [];
  const loading = searching && (members.isPending || donors.isPending);
  const error = members.error ?? donors.error;

  return (
    <Sheet visible={visible} onClose={onClose} title="Who is paying?">
      <Text style={typography.body}>Search members and outside donors by name or phone.</Text>
      <SearchBox value={term} onChangeText={setTerm} placeholder="Name or phone number" autoFocus />

      <View style={styles.results}>
        {!searching ? (
          <Text style={styles.prompt}>Type a name or number — a regular donor may already be on record.</Text>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => (members.error ? members.refetch() : donors.refetch())} />
        ) : memberRows.length === 0 && donorRows.length === 0 ? (
          <Text style={styles.prompt}>No member or donor matches “{debounced}”.</Text>
        ) : (
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {memberRows.length > 0 ? <Text style={typography.eyebrow}>Members</Text> : null}
            {memberRows.map((person) => (
              <PersonResultRow key={`m${person.id}`} person={person} action="Select" onPress={() => onPickMember(person)} />
            ))}
            {donorRows.length > 0 ? <Text style={[typography.eyebrow, styles.section]}>Outside donors</Text> : null}
            {donorRows.map((donor) => (
              <Pressable
                key={`d${donor.id}`}
                style={({ pressed }) => [styles.donor, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${donor.name}`}
                onPress={() => onPickDonor(donor)}
              >
                <Avatar name={donor.name} size={34} />
                <View style={styles.donorText}>
                  <Text style={typography.cardTitle}>{donor.name}</Text>
                  <Text style={typography.bodySmall}>
                    {[donor.organisation, donor.phone ? formatPhone(donor.phone) : null].filter(Boolean).join(" · ") ||
                      "No phone on record"}
                  </Text>
                </View>
                <Text style={styles.action}>Select</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerCancel}>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </View>
        <View style={styles.footerNew}>
          <Button label="New outside donor" icon="person-add-outline" onPress={onNewDonor} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  results: { minHeight: 90, maxHeight: 320 },
  scroll: { flexGrow: 0 },
  spinner: { paddingVertical: spacing.xl },
  prompt: { ...typography.bodySmall, paddingVertical: spacing.lg, textAlign: "center" },
  section: { marginTop: spacing.md },
  donor: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: 0.7 },
  donorText: { flex: 1, gap: 2 },
  action: { ...typography.body, color: colors.primary },
  footer: { flexDirection: "row", gap: spacing.sm },
  footerCancel: { flexBasis: 100, flexGrow: 0 },
  footerNew: { flex: 1 }
});
