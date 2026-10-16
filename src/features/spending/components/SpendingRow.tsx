import { StyleSheet, Text, View } from "react-native";
import type { Spending } from "../../../api";
import { Card } from "../../../components/ui";
import { colors, spacing, typography } from "../../../theme";
import { formatDate, formatMoney, paymentModeLabel, voidReasonLabel } from "../../../utils/format";
import { StatusTag } from "../../money/components/StatusTag";

type Props = {
  spending: Spending;
  onPress: () => void;
  /**
   * Where the row is listed. On an **event** a general-fund bill is tagged "Paid from general
   * fund"; on the **general fund** an event's bill is tagged "For <event>".
   */
  context: "event" | "fund";
};

/** One spending on a Spendings tab (spec §6.9): what for, vendor, amount, and its tags. */
export function SpendingRow({ spending: s, onPress, context }: Props) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Spending ${s.title}`}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[typography.cardTitle, s.voided && styles.struck]}>{s.title}</Text>
          {s.vendor ? <Text style={typography.bodySmall}>{s.vendor}</Text> : null}
        </View>
        <Text style={[styles.amount, s.voided && styles.struck]}>{formatMoney(s.amount)}</Text>
      </View>
      <View style={styles.tags}>
        <StatusTag label={paymentModeLabel(s.paymentMode)} tone="muted" />
        <StatusTag label={formatDate(s.spentOn)} tone="muted" />
        {s.hasBill ? <StatusTag label="Bill attached" tone="success" /> : <StatusTag label="Bill missing" tone="notice" />}
        {context === "event" && s.paidFrom === "GENERAL" ? <StatusTag label="Paid from general fund" tone="notice" /> : null}
        {context === "fund" && s.event ? <StatusTag label={`For ${s.event.name}`} tone="muted" /> : null}
        {s.voided ? (
          <StatusTag label={`VOIDED${s.voidReason ? ` · ${voidReasonLabel(s.voidReason)}` : ""}`} tone="error" />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  amount: { ...typography.mono, fontSize: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  struck: { textDecorationLine: "line-through", color: colors.muted }
});
