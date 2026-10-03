import { StyleSheet, Text, View } from "react-native";
import type { ShopListItem } from "../../../api";
import { BusinessName, Card } from "../../../components/ui";
import { feeChipLabel, formatMoney, shopTitle } from "../../../utils/format";
import { spacing, typography } from "../../../theme";
import { StatusTag, feeTone } from "../../money/components/StatusTag";

/**
 * A row in the shops list (integration doc §5.2).
 *
 * Shows shop number, business name, lane, licence holder, "Rented to …" when there is a
 * renter, the staff count, and this year's fee chip (spec §6.2) — **no chip at all** under
 * `NO_DEMAND`, where a "₹0" or "Due" would be invented. Arrears from closed years get their
 * own line, since the chip only speaks for this year.
 */
export function ShopCard({ shop, onPress }: { shop: ShopListItem; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${shop.shopNumber} ${shopTitle(shop)}`}>
      <View style={styles.header}>
        <Text style={styles.number}>{shop.shopNumber}</Text>
        <Text style={[typography.bodySmall, styles.lane]}>{shop.lane}</Text>
        {feeChipLabel(shop.feeStatus) ? (
          <StatusTag label={feeChipLabel(shop.feeStatus) as string} tone={feeTone(shop.feeStatus)} />
        ) : null}
      </View>

      <BusinessName businessName={shop.businessName} style={typography.cardTitle} />

      <Text style={typography.body}>
        {/* At most one owner, and possibly none — a shop whose holder was deleted before
            the API guarded that is ownerless until someone transfers into it. */}
        {shop.licenceHolderName ?? "Licence holder not on record"}
      </Text>

      {shop.rentedToName ? (
        <Text style={typography.body}>Rented to {shop.rentedToName}</Text>
      ) : null}

      {shop.staffCount > 0 ? (
        <Text style={typography.bodySmall}>
          {shop.staffCount} {shop.staffCount === 1 ? "worker" : "workers"} on record
        </Text>
      ) : null}

      {shop.feeStatus === "PARTIAL" && shop.feeDue !== null ? (
        <Text style={typography.bodySmall}>{formatMoney(shop.feeDue)} still due this year</Text>
      ) : null}
      {shop.arrearsAmount > 0 ? (
        <Text style={typography.bodySmall}>{formatMoney(shop.arrearsAmount)} arrears from earlier years</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lane: { flex: 1 },
  number: { ...typography.mono, fontSize: 16 }
});
