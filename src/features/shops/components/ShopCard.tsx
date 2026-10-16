import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ShopListItem } from "../../../api";
import { BusinessName, Card } from "../../../components/ui";
import { colors, spacing, typography } from "../../../theme";
import { feeChipLabel, formatMoney, shopTitle } from "../../../utils/format";
import { StatusTag, feeTone } from "../../money/components/StatusTag";

/**
 * A row in the shops list (integration doc §5.2).
 *
 * Every value is **labelled**, in this order — shop no., licence holder, business name, wing /
 * lane, then the renter and the staff count when there are any — because bare values side by
 * side were misread (a lane "2" next to shop "45" read as one number). This year's fee chip sits on the
 * first line (spec §6.2) — **no chip at all** under `NO_DEMAND`, where a "₹0" or "Due" would be
 * invented. Arrears from closed years get their own line, since the chip only speaks for this
 * year.
 */
export function ShopCard({ shop, onPress }: { shop: ShopListItem; onPress: () => void }) {
  const chip = feeChipLabel(shop.feeStatus);
  return (
    <Card onPress={onPress} accessibilityLabel={`${shop.shopNumber} ${shopTitle(shop)}`}>
      <Row label="Shop no." trailing={chip ? <StatusTag label={chip} tone={feeTone(shop.feeStatus)} /> : null}>
        <Text style={styles.number}>{shop.shopNumber}</Text>
      </Row>
      <Row label="Licence holder">
        {/* At most one owner, and possibly none — a shop whose holder was deleted before
            the API guarded that is ownerless until someone transfers into it. */}
        <Text style={shop.licenceHolderName ? typography.body : styles.missing}>
          {shop.licenceHolderName ?? "Not on record"}
        </Text>
      </Row>
      <Row label="Business name">
        <BusinessName businessName={shop.businessName} style={typography.body} />
      </Row>
      <Row label="Wing / lane">
        <Text style={typography.body}>{shop.lane}</Text>
      </Row>
      {shop.rentedToName ? (
        <Row label="Rented to">
          <Text style={typography.body}>{shop.rentedToName}</Text>
        </Row>
      ) : null}
      {shop.staffCount > 0 ? (
        <Row label="Workers">
          <Text style={typography.body}>{shop.staffCount} on record</Text>
        </Row>
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

/** A label on the left and its value beside it, so nothing on the card is left to guesswork. */
function Row({ label, children, trailing }: { label: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.value}>{children}</View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 2 },
  label: { ...typography.eyebrow, width: 112 },
  value: { flex: 1 },
  number: { ...typography.mono, fontSize: 16 },
  missing: { ...typography.body, color: colors.muted, fontStyle: "italic" }
});
