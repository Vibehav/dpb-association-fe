import { StyleSheet, Text, View } from "react-native";
import type { ShopListItem } from "../../../api";
import { Card } from "../../../components/ui";
import { spacing, typography } from "../../../theme";

/**
 * A row in the shops list (integration doc §5.2).
 *
 * Shows shop number, business name, lane, licence holder, "Rented to …" when there is a
 * renter, and the staff count. **No fee chip** — fees are v2.
 */
export function ShopCard({ shop, onPress }: { shop: ShopListItem; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${shop.shopNumber} ${shop.businessName}`}>
      <View style={styles.header}>
        <Text style={styles.number}>{shop.shopNumber}</Text>
        <Text style={typography.bodySmall}>{shop.lane}</Text>
      </View>

      <Text style={typography.cardTitle}>{shop.businessName}</Text>

      <Text style={typography.body}>
        {/* The API guarantees exactly one owner, but don't crash if that ever changes. */}
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
