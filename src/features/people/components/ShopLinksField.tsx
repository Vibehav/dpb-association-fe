import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LINKABLE_ROLES, type LinkableRole } from "../../../api";
import { ShopPicker } from "../../../components/search/ShopPicker";
import { Button, Card, Chip, ChipRow } from "../../../components/ui";
import { colors, spacing, typography } from "../../../theme";
import { roleLabel } from "../../../utils/format";

export type PickedLink = {
  shopId: string;
  shopNumber: string;
  businessName: string;
  role: LinkableRole;
};

type Props = {
  links: PickedLink[];
  onChange: (links: PickedLink[]) => void;
};

/**
 * "Role in the market" + "Linked shop", as the prototype's `isAddPerson` screen has them —
 * **inline in the form**, not behind a sheet.
 *
 * Pick the role, then tap a shop from the search results; the link is added immediately and
 * the search clears, ready for another. A person can legitimately hold several places at
 * once, which is why this is a list rather than a single value (spec §4.4).
 *
 * Only RENTER and STAFF are offered. An OWNER link exists solely through shop registration
 * or a licence transfer, and `POST /people` rejects one with a 400.
 */
export function ShopLinksField({ links, onChange }: Props) {
  const [role, setRole] = useState<LinkableRole>("STAFF");
  const [picking, setPicking] = useState(true);

  return (
    <Card>
      <Text style={typography.eyebrow}>Role in the market</Text>
      <ChipRow>
        {LINKABLE_ROLES.map((value) => (
          <Chip
            key={value}
            label={roleLabel(value)}
            selected={role === value}
            onPress={() => setRole(value)}
          />
        ))}
      </ChipRow>
      <Text style={typography.bodySmall}>
        The licence holder is set through shop registration or a transfer, so owner isn&apos;t
        offered here.
      </Text>

      <Text style={[typography.eyebrow, styles.sectionGap]}>Linked shop</Text>

      {links.map((link) => (
        <View key={link.shopId} style={styles.row}>
          <Text style={styles.number}>{link.shopNumber}</Text>
          <Text style={[typography.body, styles.grow]} numberOfLines={1}>
            {link.businessName}
          </Text>
          <Chip label={roleLabel(link.role)} />
          <Pressable
            onPress={() => onChange(links.filter((other) => other.shopId !== link.shopId))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${link.shopNumber}`}
          >
            <Ionicons name="close" size={18} color={colors.error} />
          </Pressable>
        </View>
      ))}

      {picking ? (
        <ShopPicker
          excludeShopIds={links.map((link) => link.shopId)}
          onPick={(shop) => {
            onChange([
              ...links,
              {
                shopId: shop.id,
                shopNumber: shop.shopNumber,
                businessName: shop.businessName,
                role
              }
            ]);
            // Collapse after the first link so the form isn't dominated by a search box.
            setPicking(false);
          }}
        />
      ) : (
        <Button
          label="Link another shop & role"
          variant="secondary"
          icon="add"
          onPress={() => setPicking(true)}
        />
      )}

      <Text style={typography.bodySmall}>
        A person can hold more than one place — e.g. owner of A-12 and renter of L3-11.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionGap: { marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  number: { ...typography.mono, fontSize: 13 },
  grow: { flex: 1 }
});
