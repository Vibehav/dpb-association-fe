import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { EventListItem } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import { Button, Card, EmptyState, ErrorState, ListFooter } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { eventDates, formatMoney } from "../../utils/format";
import { Figure, FigureRow } from "../money/components/Figures";
import { EventStatusTag } from "./components/EventStatusTag";
import { useEventsList } from "./hooks";

/**
 * The Events tab (spec §6.8) — every role.
 *
 * The server shapes the money: an admin gets In / Out / Balance for an own-fund event and a
 * single "Spent from general fund" for a general-funded one; a collector or viewer gets what
 * was collected and never sees a general-funded event at all. Nothing is computed here.
 */
export function EventsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { isAdmin } = usePermissions();
  const list = useEventsList();
  useRefreshOnFocus(list.refetch);

  const rows = list.data?.pages.flatMap((page) => page.content) ?? [];

  if (list.error && rows.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ErrorState error={list.error} title="Couldn't load events" onRetry={list.refetch} />
      </SafeAreaView>
    );
  }

  const createButton = isAdmin ? (
    <Button label="Create event" variant="secondary" icon="add" onPress={() => navigation.navigate("EventForm")} />
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={styles.content}
        refreshing={list.isRefetching}
        onRefresh={list.refetch}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => navigation.navigate("Event", { eventId: item.id })} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          list.isPending ? null : (
            <EmptyState
              icon="sparkles-outline"
              title="No events yet"
              message={isAdmin ? "Create one for a festival or a market programme." : "Events appear here once the treasurer creates them."}
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <ListFooter
              loading={list.isFetchingNextPage}
              hasMore={Boolean(list.hasNextPage)}
              error={list.error && rows.length > 0 ? list.error : undefined}
              onRetry={list.fetchNextPage}
            />
            {createButton}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function EventCard({ event: e, onPress }: { event: EventListItem; onPress: () => void }) {
  // An admin's row carries the outgoing figures; for anyone else they arrive null.
  const admin = e.totalSpent !== null;
  const carried =
    e.balanceMoved && e.movedOut !== null && e.movedOut > 0 ? ` · ${formatMoney(e.movedOut)} carried to general fund` : "";

  return (
    <Card onPress={onPress} accessibilityLabel={`Open ${e.name}`}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={typography.cardTitle}>{e.name}</Text>
          <Text style={typography.bodySmall}>
            {eventDates(e.startsOn, e.endsOn)}
            {carried}
          </Text>
        </View>
        <EventStatusTag status={e.status} />
      </View>

      {e.ownFund && admin ? (
        <FigureRow>
          <Figure label="In" value={e.collected} />
          <Figure label="Out" value={e.totalSpent} />
          <Figure label="Balance" value={e.balance} />
        </FigureRow>
      ) : e.ownFund ? (
        <FigureRow>
          <Figure label="Collected" value={e.collected} />
        </FigureRow>
      ) : (
        <FigureRow>
          <Figure label="Spent from general fund" value={e.spentFromGeneral} />
        </FigureRow>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.screen, gap: spacing.md, flexGrow: 1 },
  head: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  flex: { flex: 1, gap: 2 },
  separator: { height: spacing.md },
  footer: { gap: spacing.md }
});
