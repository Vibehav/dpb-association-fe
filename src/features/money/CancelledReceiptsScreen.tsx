import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, EmptyState, ErrorState, ListFooter } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { cancelReasonLabel, formatDate, formatMoney } from "../../utils/format";
import { useCancelledReceipts } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "CancelledReceipts">;

/**
 * Cancelled receipts (spec §6.16) — the association's audit control. Admin only; the endpoint
 * refuses anyone else. Paged server-side, most recently cancelled first.
 */
export function CancelledReceiptsScreen({ navigation }: Props) {
  const list = useCancelledReceipts();
  useRefreshOnFocus(list.refetch);

  const rows = list.data?.pages.flatMap((page) => page.content) ?? [];
  const total = list.data?.pages[0]?.totalElements ?? 0;

  if (list.error && rows.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ErrorState error={list.error} title="Couldn't load cancelled receipts" onRetry={list.refetch} />
      </SafeAreaView>
    );
  }

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
        ListHeaderComponent={
          <Text style={typography.body}>
            Receipt numbers are never reused. A cancelled entry stops counting in every total but
            stays on record with the reason and the admin&apos;s name.
          </Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => navigation.navigate("Receipt", { contributionId: item.id })}
            accessibilityLabel={`Receipt ${item.receiptNo}`}
          >
            <View style={styles.head}>
              <Text style={typography.cardTitle}>{item.payerName}</Text>
              <Text style={styles.struck}>{formatMoney(item.amount)}</Text>
            </View>
            <Text style={styles.mono}>{item.receiptNo}</Text>
            <Text style={typography.body}>
              {item.purposeLabel}
              {item.collectedByName ? ` · collected by ${item.collectedByName}` : ""}
            </Text>
            <Text style={typography.bodySmall}>
              {cancelReasonLabel(item.cancelReason)}
              {item.cancelNote ? ` (${item.cancelNote})` : ""} · cancelled by {item.cancelledByName ?? "—"} on{" "}
              {formatDate(item.cancelledAt)}
              {item.replacedByReceiptNo ? ` · replaced by ${item.replacedByReceiptNo}` : ""}
            </Text>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          list.isPending ? null : (
            <EmptyState icon="checkmark-done-outline" title="Nothing cancelled" message="No receipt has been cancelled." />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.screen, gap: spacing.md, flexGrow: 1 },
  head: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  struck: { ...typography.mono, textDecorationLine: "line-through", color: colors.muted },
  mono: { ...typography.mono, fontSize: 12 },
  separator: { height: spacing.md }
});
