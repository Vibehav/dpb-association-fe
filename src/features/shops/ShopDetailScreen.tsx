import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage, isCode, type PersonAtShop } from "../../api";
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
import { formatDate, formatMoney, roleLabel, tenancyLabel } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { ShopFeeSection } from "../money/components/ShopFeeSection";
import { useDeleteShop, useRemoveLink, useShop } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "ShopDetail">;

/**
 * One shop (integration doc §5.3), with its fee (spec §6.3): this year's card and its
 * instalments, earlier years, and Collect where the server says something is collectable.
 *
 * Money owed reaches two admin actions. **Delete** asks first, naming the amount — the server
 * enforces the same prompt (409 `fee_outstanding` until confirmed). **Transfer** is refused
 * outright while anything is due, part-paid years included, so the button is disabled with the
 * reason rather than left to fail; filling a vacancy is not blocked, since nobody could pay.
 */
export function ShopDetailScreen({ navigation, route }: Props) {
  const { shopId } = route.params;
  const { canWrite, isAdmin } = usePermissions();

  const shop = useShop(shopId);
  const deleteShop = useDeleteShop();
  const removeLink = useRemoveLink(shopId);

  const [confirmDelete, setConfirmDelete] = useState(false);
  /** The server's own `fee_outstanding` wording, when it disagrees with what we loaded. */
  const [owedMessage, setOwedMessage] = useState<string | null>(null);
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
  /**
   * A shop can legitimately have no licence holder: a member deleted before the API guarded
   * that took their owner link with them. Transfer is the only way back, so the screen names
   * the state and points at it rather than rendering a people list that is quietly short.
   */
  const hasLicenceHolder = data.people.some((link) => link.role === "OWNER");
  const owed = data.feeOutstanding.total;
  const owedByYear = data.feeOutstanding.byYear
    .map((year) => `${year.yearLabel} ${formatMoney(year.due)}`)
    .join(" · ");
  const transferBlocked = hasLicenceHolder && owed > 0;

  async function onDelete() {
    setActionError(null);
    try {
      // The admin has seen the amount in this sheet, so the confirmation travels with it.
      await deleteShop.mutateAsync({ id: shopId, confirmOutstanding: owed > 0 || owedMessage !== null });
      setConfirmDelete(false);
      setOwedMessage(null);
      navigation.goBack();
    } catch (caught) {
      if (isCode(caught, "fee_outstanding")) {
        // A receipt was cancelled since this screen loaded: ask again, in the server's words.
        setOwedMessage(caught.message);
        return;
      }
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

      <ShopFeeSection
        fee={data.fee}
        earlierYears={data.earlierYears}
        canCollect={canWrite}
        onCollect={(feeCycleId) =>
          navigation.navigate("Collect", {
            shopId,
            purpose: "ANNUAL_FEE",
            ...(feeCycleId !== null ? { feeCycleId } : {})
          })
        }
        onOpenReceipt={(contributionId) => navigation.navigate("Receipt", { contributionId })}
      />

      <Card>
        <Text style={typography.eyebrow}>People at this shop</Text>
        {!hasLicenceHolder ? (
          <Banner
            tone="notice"
            message={
              isAdmin
                ? "No licence holder on record. Use Transfer licence below to assign one."
                : "No licence holder on record. An admin can assign one."
            }
          />
        ) : null}
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
          {transferBlocked ? (
            <Banner
              tone="notice"
              message={`${formatMoney(owed)} is still due (${owedByYear}). Collect it from the current licence holder before transferring the licence.`}
            />
          ) : null}
          <Button
            label={hasLicenceHolder ? "Transfer licence" : "Assign licence holder"}
            variant="secondary"
            icon="swap-horizontal-outline"
            disabled={transferBlocked}
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
        onClose={() => {
          setConfirmDelete(false);
          setOwedMessage(null);
        }}
        onConfirm={onDelete}
        loading={deleteShop.isPending}
        destructive
        title={`Delete ${data.shopNumber}?`}
        message={`${
          owedMessage
            ? `${owedMessage}. `
            : owed > 0
              ? `It still has ${formatMoney(owed)} due (${owedByYear}); deleting it drops those dues from every pending total. `
              : ""
        }This hides the shop and unlinks everyone at it — ${data.people.length} ${
          data.people.length === 1 ? "person" : "people"
        }. The shop number becomes free for a new record. Prefer Edit if you're fixing a typo.`}
        confirmLabel={owed > 0 || owedMessage ? "Delete anyway" : "Delete shop"}
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
