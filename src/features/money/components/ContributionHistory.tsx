import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ContributionHistoryRow, Id } from "../../../api";
import { Card } from "../../../components/ui";
import { colors, spacing, typography } from "../../../theme";
import { formatDate, formatMoney, paymentModeLabel } from "../../../utils/format";
import { StatusTag } from "./StatusTag";

type Props = {
  /** From the server — cancelled receipts excluded. Never sum `rows`. */
  lifetimeTotal: number;
  hasCancelled: boolean;
  rows: ContributionHistoryRow[];
  /** Opens the receipt — Reprint for everyone; Correct and Cancel live there for admins. */
  onOpen: (contributionId: Id) => void;
};

/**
 * A member's or donor's contribution history (spec §6.5).
 *
 * Cancelled rows are listed on purpose — struck through and tagged — because the receipt was
 * issued and the member may still hold it. The total above them comes from the server and
 * already leaves them out; adding up the rows here would count them.
 */
export function ContributionHistory({ lifetimeTotal, hasCancelled, rows, onOpen }: Props) {
  return (
    <Card>
      <View style={styles.head}>
        <Text style={typography.eyebrow}>Contribution history</Text>
        <Text style={styles.total}>{formatMoney(lifetimeTotal)}</Text>
      </View>
      {hasCancelled ? (
        <Text style={typography.bodySmall}>Cancelled receipts are not counted in this total.</Text>
      ) : null}

      {rows.length === 0 ? (
        <Text style={typography.body}>No contributions on record yet.</Text>
      ) : (
        rows.map((row) => (
          <Pressable
            key={row.id}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={`Receipt ${row.receiptNo}`}
            onPress={() => onOpen(row.id)}
          >
            <View style={styles.rowText}>
              <Text style={[typography.cardTitle, row.cancelled && styles.struck]}>{row.purposeLabel}</Text>
              <Text style={typography.bodySmall}>
                {formatDate(row.collectedAt)} · {paymentModeLabel(row.paymentMode)} · {row.receiptNo}
              </Text>
              {row.replacesReceiptNo ? (
                <Text style={typography.bodySmall}>replaces {row.replacesReceiptNo}</Text>
              ) : null}
            </View>
            <View style={styles.rowEnd}>
              <Text style={[styles.amount, row.cancelled && styles.struck]}>{formatMoney(row.amount)}</Text>
              {row.cancelled ? <StatusTag label="CANCELLED" tone="error" /> : null}
            </View>
          </Pressable>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  total: { ...typography.mono, fontSize: 16 },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  rowText: { flex: 1, gap: 2 },
  rowEnd: { alignItems: "flex-end", gap: 4 },
  amount: { ...typography.mono, fontSize: 14 },
  struck: { textDecorationLine: "line-through", color: colors.muted }
});
