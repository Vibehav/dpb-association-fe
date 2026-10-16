import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FeeReceipt, Id, ShopFeeCard, ShopFeeYear } from "../../../api";
import { Button, Card } from "../../../components/ui";
import { colors, spacing, typography } from "../../../theme";
import { feeChipLabel, formatDate, formatMoney, paymentModeLabel } from "../../../utils/format";
import { StatusTag, feeTone } from "./StatusTag";

type Props = {
  fee: ShopFeeCard;
  earlierYears: ShopFeeYear[];
  /** Admin and collector. Collect still shows only where the server says `collectable`. */
  canCollect: boolean;
  /** This year's fee, or a closed year's arrear when `feeCycleId` is that year. */
  onCollect: (feeCycleId: Id | null) => void;
  onOpenReceipt: (contributionId: Id) => void;
};

/**
 * The shop's fee (spec §6.3): this year's card, then earlier years.
 *
 * Collect follows the server's `collectable` flag and nothing else — it is already false when
 * nothing is due, no demand is raised, or the shop has no licence holder to pay.
 */
export function ShopFeeSection({ fee, earlierYears, canCollect, onCollect, onOpenReceipt }: Props) {
  return (
    <>
      <Card>
        <Text style={typography.eyebrow}>Fee {fee.yearLabel ?? ""}</Text>
        {fee.status === "NO_DEMAND" ? (
          <Text style={typography.body}>
            {fee.yearLabel
              ? `No demand raised for ${fee.yearLabel} yet — this shop owes nothing for the year.`
              : "No fee year is open."}
          </Text>
        ) : (
          <>
            <View style={styles.statusRow}>
              <StatusTag label={feeChipLabel(fee.status) ?? ""} tone={feeTone(fee.status)} />
              <Text style={styles.big}>{formatMoney(fee.amount)}</Text>
            </View>
            {fee.status !== "PENDING" ? (
              <Text style={typography.body}>
                Paid {formatMoney(fee.paid)}
                {fee.due && fee.due > 0 ? ` · ${formatMoney(fee.due)} still due` : " in full"}
              </Text>
            ) : null}
            {fee.meetingNote ? <Text style={typography.bodySmall}>{fee.meetingNote}</Text> : null}
            <Receipts receipts={fee.receipts} onOpen={onOpenReceipt} />
            {canCollect && fee.collectable ? (
              <Button
                label={fee.status === "PARTIAL" ? `Collect ${formatMoney(fee.due)} due` : "Collect fee"}
                icon="cash-outline"
                onPress={() => onCollect(null)}
              />
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Earlier years</Text>
        {earlierYears.length === 0 ? (
          <Text style={typography.body}>No earlier years on record.</Text>
        ) : (
          earlierYears.map((year) => (
            <View key={year.feeCycleId} style={styles.year}>
              <View style={styles.statusRow}>
                <Text style={typography.cardTitle}>{year.yearLabel}</Text>
                <StatusTag
                  label={year.status === "PAID" ? "Paid" : year.status === "PARTIAL" ? "Part paid" : "Unpaid"}
                  tone={feeTone(year.status)}
                />
              </View>
              {/* What the shop actually paid, beside the year's price — they can differ. */}
              <Text style={typography.body}>
                Paid {formatMoney(year.paid)} of {formatMoney(year.amount)}
                {year.due > 0 ? ` · ${formatMoney(year.due)} arrears` : ""}
              </Text>
              <Receipts receipts={year.receipts} onOpen={onOpenReceipt} />
              {canCollect && year.collectable ? (
                <Button
                  label={`Collect ${year.yearLabel} arrears`}
                  variant="secondary"
                  icon="cash-outline"
                  onPress={() => onCollect(year.feeCycleId)}
                />
              ) : null}
            </View>
          ))
        )}
      </Card>
    </>
  );
}

/** A year's live receipts — its instalments, or the one receipt that paid it in full. */
function Receipts({ receipts, onOpen }: { receipts: FeeReceipt[]; onOpen: (id: Id) => void }) {
  if (receipts.length === 0) return null;
  return (
    <View style={styles.receipts}>
      {receipts.map((receipt) => (
        <Pressable
          key={receipt.id}
          style={styles.receipt}
          accessibilityRole="button"
          accessibilityLabel={`Receipt ${receipt.receiptNo}`}
          onPress={() => onOpen(receipt.id)}
        >
          <Text style={typography.bodySmall}>
            {receipt.receiptNo} · {formatDate(receipt.collectedAt)} · {paymentModeLabel(receipt.paymentMode)}
          </Text>
          <Text style={styles.receiptAmount}>{formatMoney(receipt.amount)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  big: { ...typography.mono, fontSize: 20 },
  year: { gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  receipts: { gap: 2, marginVertical: spacing.xs },
  receipt: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  receiptAmount: { ...typography.mono, fontSize: 12 }
});
