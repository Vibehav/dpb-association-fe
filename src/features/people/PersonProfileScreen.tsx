import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage, type PersonShopLink } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import { ShopSearchSheet } from "../../components/search/ShopSearchSheet";
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
import { callNumber, openWhatsApp } from "../../utils/deviceActions";
import { formatDate, roleLabel } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { useRemoveLink } from "../shops/hooks";
import { IdProofPanel } from "./components/IdProofPanel";
import { MemberPhoto } from "./components/MemberPhoto";
import { useAddPersonLink, useDeletePerson, usePerson } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "PersonProfile">;

/**
 * A member's profile (integration doc §5.8).
 *
 * Contribution history and "Record a contribution" from the design are v2 and omitted.
 */
export function PersonProfileScreen({ navigation, route }: Props) {
  const { personId } = route.params;
  const { canWrite, isAdmin } = usePermissions();

  const person = usePerson(personId);
  const addLink = useAddPersonLink(personId);
  const removeLink = useRemoveLink();
  const deletePerson = useDeletePerson();

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<PersonShopLink | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useRefreshOnFocus(person.refetch);

  if (person.isPending) return <LoadingScreen />;
  if (person.error || !person.data) {
    return (
      <Screen>
        <ErrorState error={person.error} title="Couldn't load the member" onRetry={person.refetch} />
      </Screen>
    );
  }

  const data = person.data;

  /**
   * Shops where this member holds the licence. Deleting them would strip those shops of
   * their holder, so the API refuses it (409 `person_is_owner`) — the screen says so up
   * front rather than letting an admin tap Delete and read a rejection.
   */
  const licencesHeld = data.shops.filter((shop) => shop.role === "OWNER");

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setActionError(null);
    try {
      await action();
      after?.();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  return (
    <Screen refreshing={person.isRefetching} onRefresh={person.refetch}>
      <Card>
        <View style={styles.headerRow}>
          <Avatar name={data.name} size={44} />
          <View style={styles.headerText}>
            <Text style={typography.title}>{data.name}</Text>
            {data.shops.length > 0 ? (
              <Text style={typography.bodySmall}>
                {data.shops.map((shop) => `${roleLabel(shop.role)} at ${shop.shopNumber}`).join(" · ")}
              </Text>
            ) : (
              <Text style={typography.bodySmall}>No shop linked</Text>
            )}
          </View>
        </View>
        {canWrite ? (
          <Button
            label="Edit"
            variant="secondary"
            icon="create-outline"
            onPress={() => navigation.navigate("PersonEdit", { personId })}
          />
        ) : null}
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Member photo</Text>
        <MemberPhoto personId={personId} photoUrl={data.photoUrl} canRetake={canWrite} />
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Shops &amp; roles</Text>
        {data.shops.map((link) => (
          <View key={link.linkId} style={styles.linkRow}>
            <Pressable
              style={styles.linkMain}
              accessibilityRole="button"
              accessibilityLabel={`Open ${link.shopNumber}`}
              onPress={() => navigation.navigate("ShopDetail", { shopId: link.shopId })}
            >
              <Text style={styles.number}>{link.shopNumber}</Text>
              <BusinessName businessName={link.businessName} style={typography.body} />
            </Pressable>
            <Chip label={roleLabel(link.role)} />
            {/* Owner links are replaced by a transfer, never removed. */}
            {isAdmin && link.role !== "OWNER" ? (
              <Pressable onPress={() => setUnlinking(link)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {canWrite ? (
          <Button
            label="Link another shop & role"
            variant="secondary"
            icon="add"
            onPress={() => setLinkOpen(true)}
          />
        ) : null}
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Details</Text>
        <Detail label="Phone" value={formatPhone(data.phone)} />
        <Detail label="WhatsApp" value={formatPhone(data.whatsappPhone)} />
        <Detail label="Address" value={data.address || "Not recorded"} />
        <Text style={typography.bodySmall}>
          Added on {formatDate(data.addedOn)}
          {data.addedByName ? ` · by ${data.addedByName}` : ""}
        </Text>
        <View style={styles.contactRow}>
          <View style={styles.contactAction}>
            <Button
              label="Call"
              variant="secondary"
              icon="call-outline"
              onPress={() => callNumber(data.phone)}
            />
          </View>
          <View style={styles.contactAction}>
            <Button
              label="WhatsApp"
              variant="secondary"
              icon="logo-whatsapp"
              onPress={() => openWhatsApp(data.whatsappPhone)}
            />
          </View>
        </View>
      </Card>

      <IdProofPanel
        person={data}
        onReplace={() => navigation.navigate("IdProofReplace", { personId })}
      />

      {actionError ? <Banner message={actionError} /> : null}

      {isAdmin ? (
        <Card>
          <Text style={typography.eyebrow}>Admin</Text>
          {licencesHeld.length > 0 ? (
            <>
              <Banner
                tone="notice"
                message={`${data.name} holds the licence on ${licencesHeld
                  .map((shop) => shop.shopNumber)
                  .join(", ")}. Transfer ${
                  licencesHeld.length === 1 ? "it" : "each of them"
                } to someone else first — a shop cannot be left without a licence holder.`}
              />
              {/* Straight to the transfer, so the admin doesn't have to find the shop again. */}
              {licencesHeld.map((shop) => (
                <Button
                  key={shop.linkId}
                  label={`Transfer licence for ${shop.shopNumber}`}
                  variant="secondary"
                  icon="swap-horizontal-outline"
                  onPress={() => navigation.navigate("ShopTransfer", { shopId: shop.shopId })}
                />
              ))}
            </>
          ) : null}
          <Button
            label="Delete member"
            variant="danger"
            icon="trash-outline"
            disabled={licencesHeld.length > 0}
            onPress={() => setConfirmDelete(true)}
          />
        </Card>
      ) : null}

      <ShopSearchSheet
        visible={linkOpen}
        onClose={() => {
          setLinkOpen(false);
          setLinkError(null);
        }}
        title="Link another shop"
        hint="A link is additive — every existing shop stays."
        excludeShopIds={data.shops.map((shop) => shop.shopId)}
        error={linkError}
        busy={addLink.isPending}
        // The sheet stays open until the link actually succeeds, and its error shows inside
        // the sheet. Closing first put the message in a banner far down a long scrolling
        // profile, where a refused link looked like nothing had happened at all.
        onPick={async (shop, role) => {
          setLinkError(null);
          try {
            await addLink.mutateAsync({ shopId: shop.id, role });
            setLinkOpen(false);
          } catch (caught) {
            setLinkError(errorMessage(caught));
          }
        }}
      />

      <ConfirmSheet
        visible={unlinking !== null}
        onClose={() => setUnlinking(null)}
        onConfirm={() =>
          unlinking &&
          run(() => removeLink.mutateAsync(unlinking.linkId), () => setUnlinking(null))
        }
        loading={removeLink.isPending}
        destructive
        title={`Remove from ${unlinking?.shopNumber ?? ""}?`}
        message={`${data.name} stays on the register but is no longer linked to this shop.${
          data.shops.length === 1 ? " This is their only shop, so they'll show as \"No shop linked\"." : ""
        }`}
        confirmLabel="Remove link"
      />

      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(
            () => deletePerson.mutateAsync(personId),
            () => {
              setConfirmDelete(false);
              navigation.goBack();
            }
          )
        }
        loading={deletePerson.isPending}
        destructive
        title={`Delete ${data.name}?`}
        // Only reachable when they hold no licence, so "every shop" here means their
        // renter and staff links — the guarded case never opens this sheet.
        message={`This hides the member and removes them from ${
          data.shops.length === 1 ? "the shop they're linked to" : "every shop they're linked to"
        }. Their phone number becomes free for a new record. Prefer Edit if you're fixing a typo.`}
        confirmLabel="Delete member"
      />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={typography.bodySmall}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  linkMain: { flex: 1, gap: 2 },
  number: { ...typography.mono, fontSize: 14 },
  remove: { ...typography.bodySmall, color: colors.error },
  detail: { paddingVertical: spacing.xs },
  contactRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  contactAction: { flex: 1 }
});
