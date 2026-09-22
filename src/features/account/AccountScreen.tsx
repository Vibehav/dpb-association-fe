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
import { titleCase } from "../../utils/format";
import { formatPhone } from "../../utils/phone";

/**
 * Account, reached from the initials in the header.
 *
 * Phase 1 covers identity, the rights statement, lock and sign-out. Change M-PIN and the
 * admin-only committee screen are phase 7 — change-PIN reuses the OTP screens, which
 * needs them presented from the signed-in stack.
 *
 * Everything money-shaped that the design puts here — Cash with you, Cash handovers,
 * Cancelled receipts, Annual fee cycle, Reports — is v2 and deliberately absent
 * (integration doc §5.9).
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

      <Button
        label="Change M-PIN"
        variant="secondary"
        icon="key-outline"
        onPress={() => navigation.navigate("ChangePin")}
      />

      {/* Admin only — everything money-shaped the design puts here (cash handovers,
          cancelled receipts, the fee cycle, reports) is v2 and deliberately absent. */}
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

/** Plain-language statement per role, from the capability table in integration doc §3. */
const RIGHTS: Record<Role, string> = {
  ADMIN:
    "You can do everything in the register: register and edit shops and members, add renters and staff, transfer a licence, and remove records. You can open a stored ID-proof image — every view is logged — and you manage who is on the committee.",
  COLLECTOR:
    "You can register and edit shops and members, add renters and staff, and capture member photos and ID-proof copies. You cannot open a stored ID-proof image once it is captured, transfer a licence, or remove a record.",
  VIEWER:
    "You can read the register — shops, members, and the role each person holds at each shop. You cannot add or change anything, and you cannot open stored ID-proof images."
};

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  phone: { ...typography.mono, fontSize: 12 }
});
