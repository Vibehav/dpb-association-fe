import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import type { Role } from "../../api";
import type { AppStackParamList } from "../../navigation/types";
import { useAuth } from "../../auth/AuthContext";
import { useMe } from "../../auth/useMe";
import { usePermissions } from "../../auth/usePermissions";
import { Avatar, Button, Card, ErrorState, Screen } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { spacing, typography } from "../../theme";
import { formatMoney, titleCase } from "../../utils/format";
import { MyCashCard } from "../cash/components/MyCashCard";
import { useCollectorsCash } from "../cash/hooks";
import { formatPhone } from "../../utils/phone";

/**
 * Account, reached from the initials in the header.
 *
 * Identity, the rights statement, Change M-PIN, lock and sign-out; for an admin, the
 * committee and — since v2 Phase 1 — the annual fee year and cancelled receipts.
 *
 * Since Phase 3: a collector's "Cash with you" card, and an admin's Cash handovers row with what
 * is still with the collectors. Reports from the design stay absent until their API exists.
 */
export function AccountScreen() {
  const { phone, lock, signOut } = useAuth();
  const me = useMe();
  const permissions = usePermissions();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  useRefreshOnFocus(me.refetch);

  if (me.error) {
    return (
      <Screen>
        <ErrorState error={me.error} title="Couldn't load your account" onRetry={me.refetch} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={me.isFetching} onRefresh={me.refetch}>
      <Card>
        <View style={styles.identity}>
          <Avatar name={me.data?.name ?? "?"} size={48} />
          <View style={styles.identityText}>
            <Text style={typography.cardTitle}>{me.data?.name ?? "…"}</Text>
            <Text style={typography.body}>{me.data ? titleCase(me.data.role) : ""}</Text>
            <Text style={styles.phone}>{formatPhone(phone)}</Text>
          </View>
        </View>
      </Card>

      {me.data ? (
        <Card>
          <Text style={typography.eyebrow}>Your rights</Text>
          <Text style={typography.body}>{RIGHTS[me.data.role]}</Text>
        </Card>
      ) : null}

      {permissions.role === "COLLECTOR" ? <MyCashCard /> : null}

      <Button
        label="Change M-PIN"
        variant="secondary"
        icon="key-outline"
        onPress={() => navigation.navigate("ChangePin")}
      />

      {/* Admin only. Reports are a later money phase. */}
      {permissions.isAdmin ? (
        <>
          <CashHandoversRow onPress={() => navigation.navigate("CashHandovers")} />
          <Button
            label="Annual fee"
            variant="secondary"
            icon="calendar-outline"
            onPress={() => navigation.navigate("FeeCycle")}
          />
          <Button
            label="Cancelled receipts"
            variant="secondary"
            icon="close-circle-outline"
            onPress={() => navigation.navigate("CancelledReceipts")}
          />
        </>
      ) : null}
      {permissions.canManageCommittee ? (
        <Button
          label="Committee members & roles"
          variant="secondary"
          icon="people-circle-outline"
          onPress={() => navigation.navigate("Committee")}
        />
      ) : null}

      <Button label="Lock app" variant="secondary" icon="lock-closed-outline" onPress={lock} />
      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
    </Screen>
  );
}

/** "₹42,700 still with the collectors · 1 waiting" — loaded only for an admin. */
function CashHandoversRow({ onPress }: { onPress: () => void }) {
  const cash = useCollectorsCash();
  const c = cash.data;
  return (
    <Card onPress={onPress} accessibilityLabel="Open cash handovers">
      <Text style={typography.cardTitle}>Cash handovers</Text>
      <Text style={typography.bodySmall}>
        {c
          ? `${formatMoney(c.totalWithCollectors)} still with the collectors${c.pendingCount > 0 ? ` · ${c.pendingCount} waiting` : ""}`
          : "What each collector is holding"}
      </Text>
    </Card>
  );
}

/** Plain-language statement per role, from the capability table in integration doc §3. */
const RIGHTS: Record<Role, string> = {
  ADMIN:
    "You can do everything in the register: register and edit shops and members, add renters and staff, transfer a licence, and remove records. You can open a stored ID-proof image — every view is logged — and you manage who is on the committee. You collect money and issue receipts, set the annual fee, see the general fund, and cancel or correct a receipt.",
  COLLECTOR:
    "You can register and edit shops and members, add renters and staff, and capture member photos and ID-proof copies. You collect money and issue receipts. You cannot open a stored ID-proof image once it is captured, transfer a licence, remove a record, see the fund's balance, or cancel or correct a receipt — telephone the treasurer for that.",
  VIEWER:
    "You can read the register — shops, members, and the role each person holds at each shop — and the money collected. You cannot add or change anything, see the fund's balance, or open stored ID-proof images."
};

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  phone: { ...typography.mono, fontSize: 12 }
});
