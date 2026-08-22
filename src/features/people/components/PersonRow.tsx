import { StyleSheet, Text, View } from "react-native";
import type { PersonListItem } from "../../../api";
import { Avatar, Card, Chip } from "../../../components/ui";
import { spacing, typography } from "../../../theme";
import { roleLabel } from "../../../utils/format";
import { formatPhone } from "../../../utils/phone";

/**
 * A row in the people list (integration doc §5.6).
 *
 * Lifetime given, last contribution and the Collect action from the design are all v2 and
 * omitted. Tapping the row opens the profile, which is what "History" did in the design.
 */
export function PersonRow({ person, onPress }: { person: PersonListItem; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={person.name}>
      <View style={styles.head}>
        <Avatar name={person.name} size={38} />
        <View style={styles.headText}>
          <Text style={typography.cardTitle}>{person.name}</Text>
          <Text style={styles.mono}>{formatPhone(person.phone)}</Text>
        </View>
      </View>

      {person.shops.length > 0 ? (
        <View style={styles.shops}>
          {person.shops.map((shop) => (
            <Chip key={shop.linkId} label={`${shop.shopNumber} · ${roleLabel(shop.role)}`} />
          ))}
        </View>
      ) : (
        // Reachable once someone's last renter/staff link is removed — it can't be created
        // this way, but it must render (integration doc §9).
        <Text style={typography.bodySmall}>No shop linked</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 12 },
  shops: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }
});
