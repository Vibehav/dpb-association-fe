import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PersonListItem } from "../../api";
import { colors, radii, spacing, typography } from "../../theme";
import { roleLabel } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { Avatar } from "../ui/Avatar";

/**
 * A person in a search result list. Shared by the pick sheet and the inline pickers, so a
 * match looks the same wherever you are searching.
 *
 * Existing shops and roles are shown deliberately — that line is what tells a collector
 * "this is the right Ramesh".
 */
export function PersonResultRow({
  person,
  onPress,
  action
}: {
  person: PersonListItem;
  onPress: () => void;
  /** Trailing affordance, e.g. "Link" or "Select". */
  action?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${action ?? "Select"} ${person.name}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={person.name} size={34} />
      <View style={styles.text}>
        <Text style={typography.cardTitle}>{person.name}</Text>
        <Text style={styles.mono}>{formatPhone(person.phone)}</Text>
        {person.shops.length > 0 ? (
          <Text style={typography.bodySmall} numberOfLines={2}>
            {person.shops.map((shop) => `${shop.shopNumber} · ${roleLabel(shop.role)}`).join("   ")}
          </Text>
        ) : (
          <Text style={typography.bodySmall}>No shop linked</Text>
        )}
      </View>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md
  },
  pressed: { backgroundColor: colors.soft },
  text: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 12 },
  action: { ...typography.bodySmall, color: colors.primary }
});
