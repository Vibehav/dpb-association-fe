import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { IdProofFilter, LinkRole, PhotoFilter } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import { SearchWithFilters, type FilterValues } from "../../components/search/SearchWithFilters";
import { Button, EmptyState, ErrorState, ListFooter } from "../../components/ui";
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
 * "show me the pending ones" has to be a query, and it sits beside the role filter.
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

  // Behind the Filter button; only the ones in force show under the search box. The ID-proof
  // and photo filters still compose — "No ID proof" + "No photo" is the members with no image.
  const filterSections = [
    {
      key: "role",
      title: "Role",
      anyLabel: "All roles",
      options: ROLES.map((value) => ({ value, label: roleLabel(value) }))
    },
    { key: "idProof", title: "ID proof", anyLabel: "Any", options: ID_PROOF_FILTERS },
    { key: "photo", title: "Photo", anyLabel: "Any", options: PHOTO_FILTERS }
  ];
  const filterValues: FilterValues = { role, idProof, photo };
  function applyFilters(next: FilterValues) {
    setRole((next.role as LinkRole | null) ?? null);
    setIdProof((next.idProof as IdProofFilter | null) ?? null);
    setPhoto((next.photo as PhotoFilter | null) ?? null);
  }

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
            <SearchWithFilters
              term={term}
              onChangeTerm={setTerm}
              placeholder="Search name, phone or shop number"
              sections={filterSections}
              values={filterValues}
              onChangeValues={applyFilters}
            />
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
            onCollect={canWrite ? () => navigation.navigate("Collect", { personId: item.id }) : undefined}
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
