import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage, type LinkableRole, type NewPersonPayload } from "../../api";
import { PersonSearchSheet } from "../../components/search/PersonSearchSheet";
import { ShopSearchSheet } from "../../components/search/ShopSearchSheet";
import { Button, Card, Chip, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { roleLabel } from "../../utils/format";
import { validateLinks } from "../../utils/validators";
import { MemberForm } from "./MemberForm";
import { useCreatePerson } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "AddMember">;

type PickedLink = {
  shopId: string;
  shopNumber: string;
  businessName: string;
  role: LinkableRole;
};

/**
 * Add a member from the People tab — `POST /people` (integration doc §5.8).
 *
 * Opens with the **search sheet, not the form** (§5.7): at ~2,300 people, letting someone
 * type a fresh profile without looking first is how you end up with two half-records and a
 * split history.
 *
 * At least one RENTER/STAFF link is mandatory. There is deliberately no way to pick OWNER —
 * an owner exists only through shop registration or a licence transfer.
 */
export function AddMemberScreen({ navigation }: Props) {
  const create = useCreatePerson();

  // Search first. The form only appears once the user has looked and not found them.
  const [searchOpen, setSearchOpen] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);
  const [links, setLinks] = useState<PickedLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(person: NewPersonPayload) {
    setError(null);
    try {
      const created = await create.mutateAsync({
        person,
        links: links.map((link) => ({ shopId: link.shopId, role: link.role }))
      });
      navigation.replace("PersonProfile", { personId: created.id });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const linksSection = (
    <Card>
      <Text style={typography.eyebrow}>Shops &amp; roles · at least one</Text>
      <Text style={typography.bodySmall}>
        The licence holder is set through shop registration or a transfer, so only renter and
        worker roles can be chosen here.
      </Text>

      {links.map((link) => (
        <View key={link.shopId} style={styles.row}>
          <Text style={styles.number}>{link.shopNumber}</Text>
          <Text style={[typography.body, styles.grow]} numberOfLines={1}>
            {link.businessName}
          </Text>
          <Chip label={roleLabel(link.role)} />
          <Pressable
            onPress={() => setLinks(links.filter((other) => other.shopId !== link.shopId))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${link.shopNumber}`}
          >
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}

      <Button
        label={links.length === 0 ? "Link a shop & role" : "Link another shop & role"}
        variant="secondary"
        icon="add"
        onPress={() => setShopOpen(true)}
      />
    </Card>
  );

  return (
    <>
      <Screen>
        <MemberForm
          submitLabel="Save member"
          submitting={create.isPending}
          error={error}
          onSubmit={submit}
          onBack={() => navigation.goBack()}
          linksSection={linksSection}
          validateLinks={() => validateLinks(links)}
        />
      </Screen>

      <PersonSearchSheet
        visible={searchOpen}
        onClose={() => {
          // Backing out of the search without picking means leaving — the form is only
          // reachable through "not on record".
          setSearchOpen(false);
          navigation.goBack();
        }}
        title="Add a member"
        hint="Search first. If they already have a profile, open it instead of making a second one."
        onPickExisting={(person) => {
          setSearchOpen(false);
          navigation.replace("PersonProfile", { personId: person.id });
        }}
        onCreateNew={() => setSearchOpen(false)}
      />

      <ShopSearchSheet
        visible={shopOpen}
        onClose={() => setShopOpen(false)}
        title="Link a shop"
        excludeShopIds={links.map((link) => link.shopId)}
        onPick={(shop, role) => {
          setShopOpen(false);
          setLinks([
            ...links,
            {
              shopId: shop.id,
              shopNumber: shop.shopNumber,
              businessName: shop.businessName,
              role
            }
          ]);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  number: { ...typography.mono, fontSize: 13 },
  grow: { flex: 1 },
  remove: { ...typography.bodySmall, color: colors.error }
});
