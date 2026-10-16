import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { FundIncomeRow, FundSummary, Spending } from "../../api";
import { Button, Card, Chip, ChipRow, EmptyState, ErrorState, ListFooter } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatDate, formatMoney } from "../../utils/format";
import { SpendingRow } from "../spending/components/SpendingRow";
import { Figure, FigureRow } from "./components/Figures";
import { IncomeRow } from "./components/IncomeRow";
import { useFundIncome, useFundSpendings, useFundSummary } from "./hooks";

type Tab = "spend" | "income";
type Row = { kind: "spend"; item: Spending } | { kind: "income"; item: FundIncomeRow };

/**
 * The general fund ledger (spec §6.10) — an admin-only tab. The endpoint itself refuses
 * anyone else, so this is not merely hidden.
 *
 * Income is fees and one-off giving; spending is running costs and "event support" — an event's
 * bill paid from here, tagged with the event. The balance also counts the opening balance and
 * whatever events have moved in, so the screen spells those out: collected − spent alone would
 * not add up to it.
 */
export function FundScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [tab, setTab] = useState<Tab>("spend");
  const summary = useFundSummary();
  const income = useFundIncome();
  const spendings = useFundSpendings(tab === "spend");
  const list = tab === "spend" ? spendings : income;

  async function refresh() {
    await Promise.all([summary.refetch(), list.refetch()]);
  }
  useRefreshOnFocus(refresh);

  const rows: Row[] =
    tab === "spend"
      ? (spendings.data?.pages.flatMap((page) => page.content) ?? []).map((item) => ({ kind: "spend" as const, item }))
      : (income.data?.pages.flatMap((page) => page.content) ?? []).map((item) => ({ kind: "income" as const, item }));
  const total = list.data?.pages[0]?.totalElements ?? 0;
  const error = summary.error ?? (rows.length === 0 ? list.error : null);

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ErrorState error={error} title="Couldn't load the general fund" onRetry={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => `${row.kind}${row.item.id}`}
        contentContainerStyle={styles.content}
        refreshing={summary.isRefetching || list.isRefetching}
        onRefresh={refresh}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            {summary.data ? (
              <Header
                summary={summary.data}
                onOpening={() => navigation.navigate("OpeningBalance")}
                onEvent={(eventId) => navigation.navigate("Event", { eventId })}
              />
            ) : null}
            <ChipRow>
              <Chip label="Spendings" selected={tab === "spend"} onPress={() => setTab("spend")} />
              <Chip label="Income" selected={tab === "income"} onPress={() => setTab("income")} />
            </ChipRow>
            {tab === "spend" ? (
              <Button label="Add spending" icon="add" onPress={() => navigation.navigate("SpendingForm")} />
            ) : null}
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === "spend" ? (
            <SpendingRow
              spending={row.item}
              context="fund"
              onPress={() => navigation.navigate("Spending", { spendingId: row.item.id })}
            />
          ) : (
            <IncomeRow row={row.item} onPress={() => navigation.navigate("Receipt", { contributionId: row.item.id })} />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          list.isPending ? null : tab === "spend" ? (
            <EmptyState icon="receipt-outline" title="No spending yet" message="Running costs and event support appear here." />
          ) : (
            <EmptyState icon="cash-outline" title="No income yet" message="Receipts appear here as they are issued." />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={list.isFetchingNextPage}
            hasMore={Boolean(list.hasNextPage)}
            error={list.error && rows.length > 0 ? list.error : undefined}
            onRetry={list.fetchNextPage}
            endLabel={total > 0 ? `All ${total.toLocaleString("en-IN")} shown` : undefined}
          />
        }
      />
    </SafeAreaView>
  );
}

function Header({
  summary: f,
  onOpening,
  onEvent
}: {
  summary: FundSummary;
  onOpening: () => void;
  onEvent: (eventId: number) => void;
}) {
  const extras = [
    f.openingBalance ? `opening balance ${formatMoney(f.openingBalance.amount)} (as on ${formatDate(f.openingBalance.asOn)})` : null,
    f.movedIn !== 0 ? `${formatMoney(f.movedIn)} moved in from events` : null
  ].filter(Boolean);

  return (
    <>
      <Card>
        <Text style={typography.eyebrow}>General fund balance</Text>
        <Text style={styles.balance}>{formatMoney(f.balance)}</Text>
        <FigureRow>
          <Figure label="Collected" value={f.collected} />
          <Figure label="Spent" value={f.spent} />
          <Figure label="Receipts" text={String(f.receiptCount)} />
        </FigureRow>
        {extras.length > 0 ? <Text style={typography.bodySmall}>Includes {extras.join(" and ")}.</Text> : null}
        {f.eventSupport > 0 ? (
          <Text style={typography.bodySmall}>
            {formatMoney(f.eventSupport)} of general fund spending went to support events.
          </Text>
        ) : null}
        {f.movedInLines.map((line) => (
          <Pressable
            key={line.eventId}
            style={styles.line}
            onPress={() => onEvent(line.eventId)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${line.eventName}`}
          >
            <Text style={[typography.bodySmall, styles.flex]}>From {line.eventName}</Text>
            <Text style={styles.mono}>{formatMoney(line.amount)}</Text>
          </Pressable>
        ))}
      </Card>

      {f.openingBalance ? (
        <Button label="Opening balance" variant="ghost" onPress={onOpening} />
      ) : (
        <Card onPress={onOpening} accessibilityLabel="Enter the opening balance">
          <Text style={typography.cardTitle}>Enter the opening balance</Text>
          <Text style={typography.bodySmall}>
            What the association already holds, so the balance matches the bank. Until then, a bill paid out of older
            money can&apos;t be recorded.
          </Text>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.screen, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md },
  balance: { ...typography.display, fontSize: 32 },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.xs },
  flex: { flex: 1 },
  mono: { ...typography.mono, fontSize: 12 },
  separator: { height: spacing.md }
});
