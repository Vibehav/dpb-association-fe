import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, EmptyState, ErrorState, ListFooter } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatDate, formatMoney, paymentModeLabel } from "../../utils/format";
import { StatusTag } from "./components/StatusTag";
import { useFundIncome, useFundSummary } from "./hooks";

/**
 * The general fund ledger (spec §6.10) — an admin-only tab. The endpoint itself refuses
 * anyone else, so this is not merely hidden.
 *
 * Phase 1 has income only: fees and one-off giving. Spending — and with it the Spendings tab
 * and the statement — arrives with Phase 2, so `spent` is shown as the server sends it (0).
 */
export function FundScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const summary = useFundSummary();
  const income = useFundIncome();

  async function refresh() {
    await Promise.all([summary.refetch(), income.refetch()]);
  }
  useRefreshOnFocus(refresh);

  const rows = income.data?.pages.flatMap((page) => page.content) ?? [];
  const total = income.data?.pages[0]?.totalElements ?? 0;
  const error = summary.error ?? (rows.length === 0 ? income.error : null);

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
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={styles.content}
        refreshing={summary.isRefetching || income.isRefetching}
        onRefresh={refresh}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (income.hasNextPage && !income.isFetchingNextPage) income.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card>
              <Text style={typography.eyebrow}>General fund balance</Text>
              <Text style={styles.balance}>{formatMoney(summary.data?.balance)}</Text>
              <View style={styles.figures}>
                <Figure label="Collected" value={summary.data?.collected} />
                <Figure label="Spent" value={summary.data?.spent} />
                <Figure label="Receipts" text={summary.data ? String(summary.data.receiptCount) : "—"} />
              </View>
            </Card>
            <Text style={typography.eyebrow}>Income</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => navigation.navigate("Receipt", { contributionId: item.id })}
            accessibilityLabel={`Receipt ${item.receiptNo}`}
          >
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[typography.cardTitle, item.cancelled && styles.struckText]}>{item.payerName}</Text>
                <Text style={typography.bodySmall}>
                  {item.purposeLabel} · {paymentModeLabel(item.paymentMode)} · {formatDate(item.collectedAt)}
                </Text>
                <Text style={styles.mono}>{item.receiptNo}</Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={[styles.amount, item.cancelled && styles.struckText]}>{formatMoney(item.amount)}</Text>
                {item.cancelled ? <StatusTag label="CANCELLED" tone="error" /> : null}
              </View>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          income.isPending ? null : (
            <EmptyState icon="cash-outline" title="No income yet" message="Receipts appear here as they are issued." />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={income.isFetchingNextPage}
            hasMore={Boolean(income.hasNextPage)}
            error={income.error && rows.length > 0 ? income.error : undefined}
            onRetry={income.fetchNextPage}
            endLabel={total > 0 ? `All ${total.toLocaleString("en-IN")} shown` : undefined}
          />
        }
      />
    </SafeAreaView>
  );
}

function Figure({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={typography.eyebrow}>{label}</Text>
      <Text style={styles.figureValue}>{text ?? formatMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.screen, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md },
  balance: { ...typography.display, fontSize: 32 },
  figures: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  figure: { flex: 1, gap: 2 },
  figureValue: { ...typography.mono, fontSize: 14 },
  row: { flexDirection: "row", gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  rowEnd: { alignItems: "flex-end", gap: 4 },
  amount: { ...typography.mono, fontSize: 14 },
  mono: { ...typography.mono, fontSize: 11 },
  struckText: { textDecorationLine: "line-through", color: colors.muted },
  separator: { height: spacing.md }
});
