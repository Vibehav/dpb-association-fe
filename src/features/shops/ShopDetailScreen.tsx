import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage, type PersonAtShop } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import {
  Avatar,
  Banner,
  BusinessName,
  Button,
  Card,
  Chip,
  ConfirmSheet,
  ErrorState,
  LoadingScreen,
  Screen
} from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatDate, roleLabel, tenancyLabel } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { useDeleteShop, useRemoveLink, useShop } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "ShopDetail">;

/**
 * One shop (integration doc §5.3).
 *
 * The fee card and "Earlier years" from the design are omitted — both are v2.
 */
export function ShopDetailScreen({ navigation, route }: Props) {
  const { shopId } = route.params;
  const { canWrite, isAdmin } = usePermissions();

  const shop = useShop(shopId);
  const deleteShop = useDeleteShop();
  const removeLink = useRemoveLink(shopId);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlinking, setUnlinking] = useState<PersonAtShop | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useRefreshOnFocus(shop.refetch);

  if (shop.isPending) return <LoadingScreen />;
  if (shop.error || !shop.data) {
    return (
      <Screen>
        <ErrorState error={shop.error} title="Couldn't load the shop" onRetry={shop.refetch} />
      </Screen>
    );
  }

  const data = shop.data;

  async function onDelete() {
    setActionError(null);
    try {
      await deleteShop.mutateAsync(shopId);
      setConfirmDelete(false);
      navigation.goBack();
    } catch (caught) {
      setConfirmDelete(false);
      setActionError(errorMessage(caught));
    }
  }

  async function onUnlink(link: PersonAtShop) {
    setActionError(null);
    try {
      await removeLink.mutateAsync(link.linkId);
      setUnlinking(null);
    } catch (caught) {
      setUnlinking(null);
      setActionError(errorMessage(caught));
    }
  }

  return (
    <Screen refreshing={shop.isRefetching} onRefresh={shop.refetch}>
      {/* Header layout follows the prototype's `isShop`: number, business name and lane
          stacked on the left, Edit inline on the right. */}
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.number}>{data.shopNumber}</Text>
            <BusinessName businessName={data.businessName} style={typography.title} />
            <Text style={typography.body}>{data.lane}</Text>
          </View>
          {canWrite ? (
            <Button
              label="Edit"
              variant="secondary"
              icon="create-outline"
              onPress={() => navigation.navigate("ShopForm", { shopId })}
            />
          ) : null}
        </View>

        <View style={styles.tenancyRow}>
          <Chip label={tenancyLabel(data.tenancy)} />
        </View>

        {/* Written by a transfer — the old holder keeps their own contribution history. */}
        {data.formerHolderName ? (
          <Text style={typography.bodySmall}>
            Previously: {data.formerHolderName}
            {data.formerHolderTill ? ` · licence held till ${formatDate(data.formerHolderTill)}` : ""}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={typography.eyebrow}>People at this shop</Text>
        {/* The API returns these ordered owner, renter, then staff. */}
        {data.people.map((link) => (
          <PersonRow
            key={link.linkId}
            link={link}
            onPress={() => navigation.navigate("PersonProfile", { personId: link.personId })}
            // Removing a link is admin-only, and an OWNER link can never be removed —
            // the licence changes only through a transfer (integration doc §9).
            onRemove={isAdmin && link.role !== "OWNER" ? () => setUnlinking(link) : undefined}
          />
        ))}

        {canWrite ? (
          <Button
            label="Add person to this shop"
            variant="secondary"
            icon="person-add-outline"
            onPress={() => navigation.navigate("ShopAddPerson", { shopId })}
          />
        ) : null}
      </Card>

      {actionError ? <Banner message={actionError} /> : null}

      {isAdmin ? (
        <Card>
          <Text style={typography.eyebrow}>Admin</Text>
          <Button
            label="Transfer licence"
            variant="secondary"
            icon="swap-horizontal-outline"
            onPress={() => navigation.navigate("ShopTransfer", { shopId })}
          />
          <Button
            label="Delete shop"
            variant="danger"
            icon="trash-outline"
            onPress={() => setConfirmDelete(true)}
          />
        </Card>
      ) : null}

      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleteShop.isPending}
        destructive
        title={`Delete ${data.shopNumber}?`}
        message={`This hides the shop and unlinks everyone at it — ${data.people.length} ${
          data.people.length === 1 ? "person" : "people"
        }. The shop number becomes free for a new record. Prefer Edit if you're fixing a typo.`}
        confirmLabel="Delete shop"
      />

      <ConfirmSheet
        visible={unlinking !== null}
        onClose={() => setUnlinking(null)}
        onConfirm={() => unlinking && onUnlink(unlinking)}
        loading={removeLink.isPending}
        destructive
        title={`Remove ${unlinking?.name ?? ""}?`}
        message={`They stay on the register but are no longer linked to ${data.shopNumber}. If this is their only shop they'll show as "No shop linked".`}
        confirmLabel="Remove from shop"
      />
    </Screen>
  );
}

function PersonRow({
  link,
  onPress,
  onRemove
}: {
  link: PersonAtShop;
  onPress: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.personRow}>
      <Pressable
        style={styles.personMain}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${link.name}`}
      >
        <Avatar name={link.name} size={34} />
        <View style={styles.personText}>
          <Text style={typography.cardTitle}>{link.name}</Text>
          <Text style={styles.mono}>{formatPhone(link.phone)}</Text>
        </View>
      </Pressable>
      <Chip label={roleLabel(link.role)} />
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${link.name}`}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  tenancyRow: { flexDirection: "row", marginTop: spacing.xs },
  number: { ...typography.mono, fontSize: 17 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  personMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  personText: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 12 },
  remove: { ...typography.bodySmall, color: colors.error }
});
