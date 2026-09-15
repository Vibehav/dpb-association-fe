import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CommitteeMember } from "../../api";
import { useMe } from "../../auth/useMe";
import { Avatar, Banner, Button, Card, Chip, ErrorState, LoadingScreen, Screen } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatDate, titleCase } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { MemberActionsSheet } from "./MemberActionsSheet";
import { useCommittee } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "Committee">;

/**
 * Everyone who can sign in (integration doc §5.10, spec §6.13).
 *
 * The API returns active members first, then removed ones. Removed rows stay visible,
 * greyed, with the date — that history is the point of a soft remove.
 *
 * No collection figures here, deliberately: that information belongs on each entry and
 * receipt, not against a person's name.
 */
export function CommitteeScreen({ navigation }: Props) {
  const committee = useCommittee();
  const me = useMe();
  const [selected, setSelected] = useState<CommitteeMember | null>(null);

  useRefreshOnFocus(committee.refetch);

  if (committee.isPending) return <LoadingScreen />;
  if (committee.error) {
    return (
      <Screen>
        <ErrorState error={committee.error} title="Couldn't load the committee" onRetry={committee.refetch} />
      </Screen>
    );
  }

  const members = committee.data ?? [];
  const activeAdmins = members.filter((m) => m.active && m.role === "ADMIN").length;

  return (
    <Screen refreshing={committee.isRefetching} onRefresh={committee.refetch}>
      {activeAdmins === 1 ? (
        <Banner
          tone="notice"
          message="You are the only admin. Add a second one before changing or removing an admin."
        />
      ) : null}

      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          isSelf={member.id === me.data?.id}
          // A signed-in admin may correct their own name/email, but not their role. Removed
          // members have nothing left to change.
          onPress={member.active ? () => setSelected(member) : undefined}
        />
      ))}

      <Button
        label="Add committee member"
        icon="person-add"
        onPress={() => navigation.navigate("AddCommitteeMember")}
      />

      <MemberActionsSheet
        member={selected}
        isSelf={selected?.id === me.data?.id}
        onClose={() => setSelected(null)}
      />
    </Screen>
  );
}

function MemberCard({
  member,
  isSelf,
  onPress
}: {
  member: CommitteeMember;
  isSelf: boolean;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={member.name} style={member.active ? undefined : styles.removed}>
      <View style={styles.row}>
        <Avatar name={member.name} size={38} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Text style={typography.cardTitle}>{member.name}</Text>
            {isSelf ? <Chip label="You" /> : null}
          </View>
          <Text style={styles.mono}>{formatPhone(member.phone)}</Text>
          <Text style={typography.bodySmall}>{member.email}</Text>
          {!member.active ? (
            <Text style={typography.bodySmall}>Removed {formatDate(member.removedAt)}</Text>
          ) : !member.pinSet ? (
            <Text style={typography.bodySmall}>M-PIN not set yet</Text>
          ) : null}
        </View>
        <Chip label={titleCase(member.role)} />
      </View>

      {isSelf && member.active ? (
        <Text style={typography.bodySmall}>
          You can correct your own name or email. Another admin must change your role or remove
          you. Change your own M-PIN from Account.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  removed: { opacity: 0.55 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mono: { ...typography.mono, fontSize: 12, color: colors.muted }
});
