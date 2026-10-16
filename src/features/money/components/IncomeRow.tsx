import { StyleSheet, Text, View } from "react-native";
import type { FundIncomeRow } from "../../../api";
import { Card } from "../../../components/ui";
import { colors, spacing, typography } from "../../../theme";
import { formatDate, formatMoney, paymentModeLabel } from "../../../utils/format";
import { StatusTag } from "./StatusTag";

/**
 * One receipt on an Income tab — the general fund's or an event's. A cancelled receipt stays,
 * struck through, so the list still accounts for every number issued.
 */
export function IncomeRow({ row, onPress }: { row: FundIncomeRow; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Receipt ${row.receiptNo}`}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[typography.cardTitle, row.cancelled && styles.struck]}>{row.payerName}</Text>
          <Text style={typography.bodySmall}>
            {row.purposeLabel} · {paymentModeLabel(row.paymentMode)} · {formatDate(row.collectedAt)}
          </Text>
          <Text style={styles.mono}>{row.receiptNo}</Text>
        </View>
        <View style={styles.end}>
          <Text style={[styles.amount, row.cancelled && styles.struck]}>{formatMoney(row.amount)}</Text>
          {row.cancelled ? <StatusTag label="CANCELLED" tone="error" /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  end: { alignItems: "flex-end", gap: 4 },
  amount: { ...typography.mono, fontSize: 14 },
  mono: { ...typography.mono, fontSize: 11 },
  struck: { textDecorationLine: "line-through", color: colors.muted }
});
