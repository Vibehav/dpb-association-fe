import { StyleSheet, Text, View } from "react-native";
import type { ShopListItem } from "../../../api";
import { BusinessName, Card } from "../../../components/ui";
import { shopTitle } from "../../../utils/format";
import { spacing, typography } from "../../../theme";

/**
 * A row in the shops list (integration doc §5.2).
 *
 * Shows shop number, business name, lane, licence holder, "Rented to …" when there is a
 * renter, and the staff count. **No fee chip** — fees are v2.
 */
export function ShopCard({ shop, onPress }: { shop: ShopListItem; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${shop.shopNumber} ${shopTitle(shop)}`}>
      <View style={styles.header}>
        <Text style={styles.number}>{shop.shopNumber}</Text>
        <Text style={typography.bodySmall}>{shop.lane}</Text>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  number: { ...typography.mono, fontSize: 16 }
});
