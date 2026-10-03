import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { usePermissions } from "../../auth/usePermissions";
import { Avatar, Button, Card, ErrorState, LoadingScreen, Screen } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { callNumber, openWhatsApp } from "../../utils/deviceActions";
import { formatDate } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { ContributionHistory } from "./components/ContributionHistory";
import { useDonor } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "DonorProfile">;

/**
 * An outside donor — a sponsor or a walk-up giver. Not a member of the register: no shop, no
 * photo, no ID proof. Reached from a receipt, top contributors or the fund's income list.
 */
export function DonorProfileScreen({ navigation, route }: Props) {
  const { donorId } = route.params;
  const { canWrite } = usePermissions();
  const donor = useDonor(donorId);
  useRefreshOnFocus(donor.refetch);

  if (donor.isPending) return <LoadingScreen />;
  if (donor.error || !donor.data) {
    return (
      <Screen>
        <ErrorState error={donor.error} title="Couldn't load the donor" onRetry={donor.refetch} />
      </Screen>
    );
  }

  const d = donor.data;

  return (
    <Screen refreshing={donor.isRefetching} onRefresh={donor.refetch}>
      <Card>
        <View style={styles.headerRow}>
          <Avatar name={d.name} size={44} />
          <View style={styles.headerText}>
            <Text style={typography.title}>{d.name}</Text>
            <Text style={typography.bodySmall}>{d.organisation ?? "Outside donor"}</Text>
          </View>
        </View>
        {canWrite ? (
          <Button
            label="Edit"
            variant="secondary"
            icon="create-outline"
            onPress={() => navigation.navigate("DonorEdit", { donorId })}
          />
        ) : null}
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Details</Text>
        <Text style={typography.body}>Phone: {d.phone ? formatPhone(d.phone) : "Not recorded"}</Text>
        {d.whatsappPhone && d.whatsappPhone !== d.phone ? (
          <Text style={typography.body}>WhatsApp: {formatPhone(d.whatsappPhone)}</Text>
        ) : null}
        <Text style={typography.body}>Address: {d.address || "Not recorded"}</Text>
        <Text style={typography.bodySmall}>
          Added on {formatDate(d.addedOn)}
          {d.addedByName ? ` · by ${d.addedByName}` : ""}
        </Text>
        {d.phone ? (
          <View style={styles.contactRow}>
            <View style={styles.flex}>
              <Button label="Call" variant="secondary" icon="call-outline" onPress={() => callNumber(d.phone as string)} />
            </View>
            <View style={styles.flex}>
              <Button
                label="WhatsApp"
                variant="secondary"
                icon="logo-whatsapp"
                onPress={() => openWhatsApp((d.whatsappPhone ?? d.phone) as string)}
              />
            </View>
          </View>
        ) : null}
      </Card>

      <ContributionHistory
        lifetimeTotal={d.lifetimeTotal}
        hasCancelled={d.hasCancelled}
        rows={d.contributionHistory}
        onOpen={(contributionId) => navigation.navigate("Receipt", { contributionId })}
      />

      {canWrite ? (
        <Button
          label="Record a contribution"
          icon="cash-outline"
          onPress={() => navigation.navigate("Collect", { donorId, purpose: "ONE_OFF" })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  contactRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 }
});
