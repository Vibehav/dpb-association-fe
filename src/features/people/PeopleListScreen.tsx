import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { IdProofFilter, LinkRole, PhotoFilter } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import { Button, Chip, ChipRow, EmptyState, ErrorState, ListFooter, SearchBox } from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { countLine, roleLabel } from "../../utils/format";
import { PersonRow } from "./components/PersonRow";
import { usePeopleList } from "./hooks";

const ROLES: LinkRole[] = ["OWNER", "RENTER", "STAFF"];

/**
 * The ID-proof filter, since client revision v2. `PENDING` is the queue the committee works
 * through: right after the register is loaded it is most of the membership.
 *
 * A filter on this screen rather than a separate one because the list rows carry no ID-proof
 * field of their own — the server is the only thing that knows which state a member is in, so
 * "show me the pending ones" has to be a query, and it may as well sit beside the role chips.
 */
const ID_PROOF_FILTERS: { value: IdProofFilter; label: string }[] = [
  { value: "PENDING", label: "No ID proof" },
  { value: "CAPTURED", label: "ID proof on file" }
];

/**
 * The photo filter, since client revision v3. Independent of the ID-proof one and applied
 * alongside it, so "No ID proof" + "No photo" narrows to members carrying no image at all —
 * which is most of the register right after a seed.
 */
const PHOTO_FILTERS: { value: PhotoFilter; label: string }[] = [
  { value: "PENDING", label: "No photo" },
  { value: "CAPTURED", label: "Photo on file" }
];

/**
 * The member register (integration doc §5.6). Search matches name, phone or shop number;
 * both search and pagination are server-side across ~2,300 people.
 */
export function PeopleListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { canWrite } = usePermissions();

  const [term, setTerm] = useState("");
  const [role, setRole] = useState<LinkRole | null>(null);
  const [idProof, setIdProof] = useState<IdProofFilter | null>(null);
  const [photo, setPhoto] = useState<PhotoFilter | null>(null);
  const debounced = useDebouncedValue(term.trim(), 350);

  const list = usePeopleList({
    query: debounced || undefined,
    role: role ?? undefined,
    idProof: idProof ?? undefined,
    photo: photo ?? undefined
  });
  useRefreshOnFocus(list.refetch);

  const pages = list.data?.pages ?? [];
  const people = pages.flatMap((page) => page.content);
  const total = pages[0]?.totalElements ?? 0;
  const filtered = Boolean(debounced) || role !== null || idProof !== null || photo !== null;
  // A PENDING filter that returns nothing means the queue is worked down, not that the search
  // was too narrow — worth saying differently. Only when nothing else is narrowing the list.
  const emptyQueue =
    !debounced && role === null && (idProof === "PENDING" || photo === "PENDING");

  if (list.error && people.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ErrorState error={list.error} title="Couldn't load people" onRetry={list.refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={people}
        keyExtractor={(person) => String(person.id)}
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
              placeholder="Search name, phone or shop number"
            />
            <ChipRow>
              <Chip label="All" selected={role === null} onPress={() => setRole(null)} />
              {ROLES.map((value) => (
                <Chip
                  key={value}
                  label={roleLabel(value)}
                  selected={role === value}
                  onPress={() => setRole(value)}
                />
              ))}
            </ChipRow>
            <ChipRow>
              <Chip
                label="Any ID proof"
                selected={idProof === null}
                onPress={() => setIdProof(null)}
              />
              {ID_PROOF_FILTERS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={idProof === value}
                  // Tapping the active chip clears it — the pending queue is something you
                  // dip into and back out of, not a mode to get stuck in.
                  onPress={() => setIdProof((current) => (current === value ? null : value))}
                />
              ))}
            </ChipRow>
            <ChipRow>
              <Chip label="Any photo" selected={photo === null} onPress={() => setPhoto(null)} />
              {PHOTO_FILTERS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={photo === value}
                  onPress={() => setPhoto((current) => (current === value ? null : value))}
                />
              ))}
            </ChipRow>
            {!list.isPending ? (
              <Text style={typography.bodySmall}>
                {countLine(people.length, total, "person", "people")}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PersonRow
            person={item}
            onPress={() => navigation.navigate("PersonProfile", { personId: item.id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          list.isPending ? null : (
            <EmptyState
              icon="people-outline"
              title={
                emptyQueue
                  ? "Nothing is waiting"
                  : filtered
                    ? "No one matches"
                    : "No members yet"
              }
              message={
                emptyQueue
                  ? "Every member in the register has what this filter asks for."
                  : filtered
                    ? "Try a different name, number or shop."
                    : "Members are added from a shop, or here once a shop exists."
              }
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={list.isFetchingNextPage}
            hasMore={Boolean(list.hasNextPage)}
            error={list.error && people.length > 0 ? list.error : undefined}
            onRetry={list.fetchNextPage}
            endLabel={total > 0 ? `All ${total.toLocaleString("en-IN")} shown` : undefined}
          />
        }
      />

      {canWrite ? (
        <View style={styles.actionBar}>
          <Button
            label="Add a member"
            icon="person-add"
            onPress={() => navigation.navigate("AddMember")}
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
