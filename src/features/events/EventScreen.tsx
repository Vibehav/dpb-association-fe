import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorMessage, type EventDetail, type FundIncomeRow, type Spending } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  ListFooter,
  LoadingScreen,
  Sheet
} from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { eventDates, formatDate, formatDateTime, formatMoney } from "../../utils/format";
import { Figure, FigureRow } from "../money/components/Figures";
import { IncomeRow } from "../money/components/IncomeRow";
import { SpendingRow } from "../spending/components/SpendingRow";
import { EventStatusTag } from "./components/EventStatusTag";
import {
  useCloseEvent,
  useDeleteEvent,
  useEvent,
  useEventIncome,
  useEventSpendings,
  useMoveEventBalance
} from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "Event">;
type Tab = "spend" | "income";
type Row = { kind: "spend"; item: Spending } | { kind: "income"; item: FundIncomeRow };

/**
 * An event's page (spec §6.9).
 *
 * - **Own fund, admin:** collected / spent / remaining, the record of anything moved to the
 *   general fund, then Spendings and Income.
 * - **General-funded, admin:** what the general fund spent on it; Spendings only.
 * - **Collector / viewer:** what was collected, and the Income list. Spending is withheld by
 *   the server, not just hidden here.
 *
 * Admins edit, close and — for a closed event that kept its money — move the balance from
 * here. A closed event takes nothing new, but its receipts and bills can still be fixed; if
 * its balance was moved, the server keeps it at ₹0 with adjustment lines.
 */
export function EventScreen({ navigation, route }: Props) {
  const { eventId } = route.params;
  const { isAdmin } = usePermissions();
  const event = useEvent(eventId);
  const [tab, setTab] = useState<Tab>("spend");

  const e = event.data;
  // A collector or viewer has no Spendings tab; a general-funded event has no Income tab.
  const activeTab: Tab = !isAdmin ? "income" : e && !e.ownFund ? "spend" : tab;
  const spendings = useEventSpendings(eventId, isAdmin && activeTab === "spend" && Boolean(e));
  const income = useEventIncome(eventId, activeTab === "income" && Boolean(e?.ownFund));
  const list = activeTab === "spend" ? spendings : income;

  async function refresh() {
    // `refetch` runs even on a disabled query, so only the tab actually on screen is reloaded.
    await Promise.all([event.refetch(), e ? list.refetch() : undefined]);
  }
  useRefreshOnFocus(refresh);

  if (event.isPending) return <LoadingScreen />;
  if (event.error || !e) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ErrorState error={event.error} title="Couldn't load the event" onRetry={event.refetch} />
      </SafeAreaView>
    );
  }

  const rows: Row[] =
    activeTab === "spend"
      ? (spendings.data?.pages.flatMap((page) => page.content) ?? []).map((item) => ({ kind: "spend" as const, item }))
      : (income.data?.pages.flatMap((page) => page.content) ?? []).map((item) => ({ kind: "income" as const, item }));
  const showList = activeTab === "income" ? e.ownFund : isAdmin;
  const closed = e.status === "CLOSED";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={showList ? rows : []}
        keyExtractor={(row) => `${row.kind}${row.item.id}`}
        contentContainerStyle={styles.content}
        refreshing={event.isRefetching || list.isRefetching}
        onRefresh={refresh}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Summary event={e} />
            {isAdmin ? <Transfers event={e} /> : null}

            {isAdmin && e.ownFund ? (
              <ChipRow>
                <Chip label="Spendings" selected={activeTab === "spend"} onPress={() => setTab("spend")} />
                <Chip label="Income" selected={activeTab === "income"} onPress={() => setTab("income")} />
              </ChipRow>
            ) : (
              <Text style={typography.eyebrow}>{activeTab === "spend" ? "Spendings" : "Income"}</Text>
            )}

            {closed ? <Banner tone="notice" message="This event is closed · nothing further can be added." /> : null}
            {activeTab === "spend" && isAdmin && !closed ? (
              <Button
                label="Add spending"
                icon="add"
                onPress={() => navigation.navigate("SpendingForm", { eventId })}
              />
            ) : null}
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === "spend" ? (
            <SpendingRow
              spending={row.item}
              context="event"
              onPress={() => navigation.navigate("Spending", { spendingId: row.item.id })}
            />
          ) : (
            <IncomeRow row={row.item} onPress={() => navigation.navigate("Receipt", { contributionId: row.item.id })} />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          list.isPending && showList ? null : (
            <EmptyState
              icon={activeTab === "spend" ? "receipt-outline" : "cash-outline"}
              title={activeTab === "spend" ? "No spending yet" : "No donations yet"}
              message={
                activeTab === "spend"
                  ? "Bills for this event appear here as the treasurer records them."
                  : "Donations tagged to this event appear here."
              }
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
            {isAdmin ? (
              <AdminActions
                event={e}
                onEdit={() => navigation.navigate("EventForm", { eventId })}
                onDeleted={() => navigation.goBack()}
              />
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

/** The figures card — shaped by what the server sent for this role. */
function Summary({ event: e }: { event: EventDetail }) {
  const closedLine = e.closedAt
    ? `Closed ${formatDate(e.closedAt)}${e.closedByName ? ` by ${e.closedByName}` : ""}`
    : null;

  return (
    <Card>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={typography.title}>{e.name}</Text>
          <Text style={typography.bodySmall}>{eventDates(e.startsOn, e.endsOn)}</Text>
          {closedLine ? <Text style={typography.bodySmall}>{closedLine}</Text> : null}
        </View>
        <EventStatusTag status={e.status} />
      </View>

      {!e.ownFund ? (
        <>
          <FigureRow>
            <Figure label="Spent from general fund" value={e.spentFromGeneral} />
          </FigureRow>
          <Text style={typography.bodySmall}>Paid from the general fund · no separate collection for this event.</Text>
        </>
      ) : e.showOutgoing ? (
        <>
          <FigureRow>
            <Figure label="Collected" value={e.collected} />
            <Figure label="Spent" value={e.totalSpent} />
            <Figure label="Remaining" value={e.balance} />
          </FigureRow>
          {e.spentFromGeneral !== null && e.spentFromGeneral > 0 ? (
            <Text style={typography.bodySmall}>
              {formatMoney(e.spentFromGeneral)} of this was paid directly from the general fund, so it is not deducted
              from the event fund.
            </Text>
          ) : null}
          {e.status === "CLOSED" && e.balanceMovedAt === null && e.balance !== null && e.balance > 0 ? (
            <Text style={typography.bodySmall}>{formatMoney(e.balance)} is kept in the event fund.</Text>
          ) : null}
        </>
      ) : (
        <>
          <FigureRow>
            <Figure label="Collected for this event" value={e.collected} />
          </FigureRow>
          <Text style={typography.bodySmall}>Spendings are visible to the treasurer only.</Text>
        </>
      )}
    </Card>
  );
}

/**
 * The record of money moved to the general fund: the move, then any adjustment a later fix
 * wrote. The server words each line; nothing here is for the user to act on.
 */
function Transfers({ event: e }: { event: EventDetail }) {
  if (e.transfers.length === 0) return null;
  return (
    <Card>
      <Text style={typography.eyebrow}>Carried to the general fund · {formatMoney(e.movedOut)}</Text>
      {e.transfers.map((line) => (
        <View key={line.id} style={styles.transfer}>
          <View style={styles.flex}>
            <Text style={typography.body}>{line.description}</Text>
            <Text style={typography.bodySmall}>
              {formatDateTime(line.at)}
              {line.byName ? ` · ${line.byName}` : ""}
            </Text>
          </View>
          <Text style={styles.mono}>{formatMoney(line.amount)}</Text>
        </View>
      ))}
    </Card>
  );
}

function AdminActions({ event: e, onEdit, onDeleted }: { event: EventDetail; onEdit: () => void; onDeleted: () => void }) {
  const close = useCloseEvent(e.id);
  const move = useMoveEventBalance(e.id);
  const remove = useDeleteEvent(e.id);
  const [sheet, setSheet] = useState<"close" | "move" | "delete" | null>(null);
  const [moveOnClose, setMoveOnClose] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const closed = e.status === "CLOSED";
  const left = e.balance ?? 0;
  // Only an own-fund event with money left asks what to do with it.
  const needsChoice = e.ownFund && left > 0;
  const canMoveLater = closed && e.ownFund && e.balanceMovedAt === null && left > 0;

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setError(null);
    try {
      await action();
      setSheet(null);
      after?.();
    } catch (caught) {
      setSheet(null);
      setError(errorMessage(caught));
    }
  }

  return (
    <View style={styles.actions}>
      {error ? <Banner message={error} /> : null}
      {!closed ? <Button label="Edit event" variant="secondary" icon="create-outline" onPress={onEdit} /> : null}
      {!closed ? (
        <Button label="Close this event" variant="secondary" icon="lock-closed-outline" onPress={() => setSheet("close")} />
      ) : null}
      {canMoveLater ? (
        <Button
          label={`Move ${formatMoney(left)} to the general fund`}
          variant="secondary"
          icon="arrow-forward"
          onPress={() => setSheet("move")}
        />
      ) : null}
      {e.hasEntries === false ? (
        <Button label="Delete event" variant="danger" icon="trash-outline" onPress={() => setSheet("delete")} />
      ) : null}

      {/* Own fund with money left: move it or keep it (spec §10.2). */}
      <Sheet visible={sheet === "close" && needsChoice} onClose={() => setSheet(null)} title={`Close ${e.name}`}>
        <Text style={typography.body}>
          {formatMoney(left)} is left in the {e.name} fund. After closing, no new donations or spendings can be tagged
          to it.
        </Text>
        <Text style={typography.eyebrow}>Remaining balance</Text>
        <ChipRow>
          <Chip label="Move to general fund" selected={moveOnClose} onPress={() => setMoveOnClose(true)} />
          <Chip label="Keep in event fund" selected={!moveOnClose} onPress={() => setMoveOnClose(false)} />
        </ChipRow>
        <Button label="Close event" loading={close.isPending} onPress={() => run(() => close.mutateAsync(moveOnClose))} />
        <Button label="Cancel" variant="secondary" disabled={close.isPending} onPress={() => setSheet(null)} />
      </Sheet>
      <ConfirmSheet
        visible={sheet === "close" && !needsChoice}
        onClose={() => setSheet(null)}
        onConfirm={() => run(() => close.mutateAsync(undefined))}
        loading={close.isPending}
        title={`Close ${e.name}?`}
        message="After closing, no new donations or spendings can be tagged to it."
        confirmLabel="Close event"
      />
      <ConfirmSheet
        visible={sheet === "move"}
        onClose={() => setSheet(null)}
        onConfirm={() => run(() => move.mutateAsync())}
        loading={move.isPending}
        title="Move to the general fund?"
        message={`${formatMoney(left)} kept in the ${e.name} fund moves to the general fund. This can't be undone.`}
        confirmLabel="Move it"
      />
      <ConfirmSheet
        visible={sheet === "delete"}
        onClose={() => setSheet(null)}
        onConfirm={() => run(() => remove.mutateAsync(), onDeleted)}
        loading={remove.isPending}
        title={`Delete ${e.name}?`}
        message="Nothing has been recorded against it, so it is removed from the events list."
        confirmLabel="Delete it"
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.screen, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md },
  footer: { gap: spacing.md },
  titleRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  flex: { flex: 1, gap: 2 },
  transfer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  mono: { ...typography.mono, fontSize: 13 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  separator: { height: spacing.md }
});
