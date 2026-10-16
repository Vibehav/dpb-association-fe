import { StyleSheet, Text, View } from "react-native";
import type { Handover } from "../../../api";
import { Card } from "../../../components/ui";
import { spacing, typography } from "../../../theme";
import { formatDateTime, formatMoney } from "../../../utils/format";
import { StatusTag } from "../../money/components/StatusTag";

/** One handover in a list: who, when, how much, and how the count came out. */
export function HandoverRow({ handover: h, onPress, showName }: { handover: Handover; onPress?: () => void; showName?: boolean }) {
  const diff = h.difference ?? 0;
  return (
    <Card onPress={onPress} accessibilityLabel={`Handover of ${formatMoney(h.expected)}`}>
      <View style={styles.row}>
        <View style={styles.flex}>
          {showName ? <Text style={typography.cardTitle}>{h.collectorName}</Text> : null}
          <Text style={typography.bodySmall}>
            {formatDateTime(h.filedAt)} · {h.liveReceiptCount} cash {h.liveReceiptCount === 1 ? "receipt" : "receipts"}
          </Text>
          {h.status === "RECEIVED" ? (
            <Text style={typography.bodySmall}>
              Counted {formatMoney(h.countedAmount)}
              {h.receivedByName ? ` · confirmed by ${h.receivedByName}` : ""}
              {h.note ? ` · ${h.note}` : ""}
            </Text>
          ) : null}
        </View>
        <Text style={styles.mono}>{formatMoney(h.expected)}</Text>
      </View>
      {h.status === "PENDING" ? <StatusTag label="Waiting" tone="notice" /> : null}
      {h.status === "WITHDRAWN" ? <StatusTag label="Withdrawn" tone="muted" /> : null}
      {h.status === "RECEIVED" && diff > 0 ? <StatusTag label={`${formatMoney(diff)} short`} tone="error" /> : null}
      {h.status === "RECEIVED" && diff < 0 ? <StatusTag label={`${formatMoney(-diff)} extra`} tone="notice" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 14 }
});
