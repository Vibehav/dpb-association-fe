import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LinkRole } from "../../api";
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
 * The member register (integration doc §5.6). Search matches name, phone or shop number;
 * both search and pagination are server-side across ~2,300 people.
 */
export function PeopleListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { canWrite } = usePermissions();

  const [term, setTerm] = useState("");
  const [role, setRole] = useState<LinkRole | null>(null);
  const debounced = useDebouncedValue(term.trim(), 350);

  const list = usePeopleList({ query: debounced || undefined, role: role ?? undefined });
  useRefreshOnFocus(list.refetch);

  const pages = list.data?.pages ?? [];
  const people = pages.flatMap((page) => page.content);
  const total = pages[0]?.totalElements ?? 0;
  const filtered = Boolean(debounced) || role !== null;

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
        keyExtractor={(person) => person.id}
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
              title={filtered ? "No one matches" : "No members yet"}
              message={
                filtered
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
