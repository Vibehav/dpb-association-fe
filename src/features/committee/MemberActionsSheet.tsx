import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, type CommitteeMember, type Role } from "../../api";
import { Banner, Button, Chip, ChipRow, Sheet } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { titleCase } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { useChangeRole, useRemoveCommitteeMember, useResetPin } from "./hooks";

const ROLES: Role[] = ["ADMIN", "COLLECTOR", "VIEWER"];

type Props = {
  member: CommitteeMember | null;
  onClose: () => void;
};

/**
 * Change a member's role, reset their M-PIN, or remove them (functional spec §6.13).
 *
 * Confirmation happens *inside* this sheet rather than in a second one — nesting RN
 * `Modal`s is unreliable, and a two-state sheet reads better anyway.
 *
 * The two guards come back as 400 with a message worth showing verbatim: you cannot act on
 * yourself, and the association must always keep at least one active admin. The caller
 * hides this sheet for your own row, so `self_action` should be unreachable — but the
 * server is still the authority.
 */
export function MemberActionsSheet({ member, onClose }: Props) {
  const changeRole = useChangeRole();
  const resetPin = useResetPin();
  const remove = useRemoveCommitteeMember();

  const [confirming, setConfirming] = useState<"reset" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset the sheet's internal state whenever it targets someone new.
  useEffect(() => {
    setConfirming(null);
    setError(null);
  }, [member?.id]);

  if (!member) return null;

  const busy = changeRole.isPending || resetPin.isPending || remove.isPending;

  async function run(action: () => Promise<unknown>, close: boolean) {
    setError(null);
    try {
      await action();
      if (close) onClose();
      else setConfirming(null);
    } catch (caught) {
      setConfirming(null);
      setError(errorMessage(caught));
    }
  }

  if (confirming === "reset") {
    return (
      <Sheet visible onClose={onClose} title={`Reset ${member.name}'s M-PIN?`}>
        <Text style={typography.body}>
          Their PIN is cleared and they are signed out everywhere. The next time they open the
          app they&apos;ll be asked for a one-time code and set a new PIN themselves — you never
          see or type it.
        </Text>
        {error ? <Banner message={error} /> : null}
        <Button
          label="Reset M-PIN"
          loading={resetPin.isPending}
          onPress={() => run(() => resetPin.mutateAsync(member.id), true)}
        />
        <Button label="Back" variant="secondary" onPress={() => setConfirming(null)} disabled={busy} />
      </Sheet>
    );
  }

  if (confirming === "remove") {
    return (
      <Sheet visible onClose={onClose} title={`Remove ${member.name}?`}>
        <Text style={typography.body}>
          They can no longer sign in, and are signed out everywhere immediately. Their row stays
          here marked as removed, and their number frees up so it can be added again later.
        </Text>
        {error ? <Banner message={error} /> : null}
        <Button
          label="Remove from committee"
          variant="danger"
          loading={remove.isPending}
          onPress={() => run(() => remove.mutateAsync(member.id), true)}
        />
        <Button label="Back" variant="secondary" onPress={() => setConfirming(null)} disabled={busy} />
      </Sheet>
    );
  }

  return (
    <Sheet visible onClose={onClose} title={member.name}>
      <Text style={styles.mono}>{formatPhone(member.phone)}</Text>

      <View style={styles.block}>
        <Text style={typography.eyebrow}>Role</Text>
        <ChipRow>
          {ROLES.map((role) => (
            <Chip
              key={role}
              label={titleCase(role)}
              selected={member.role === role}
              onPress={() =>
                role !== member.role && run(() => changeRole.mutateAsync({ id: member.id, role }), false)
              }
            />
          ))}
        </ChipRow>
        <Text style={typography.bodySmall}>{ROLE_SUMMARY[member.role]}</Text>
        <Text style={typography.bodySmall}>
          A role change applies immediately — on their next screen, without signing out.
        </Text>
      </View>

      {!member.pinSet ? (
        <Banner tone="notice" message="They haven't set an M-PIN yet — they will on first sign-in." />
      ) : null}

      {error ? <Banner message={error} /> : null}

      <Button
        label="Reset their M-PIN"
        variant="secondary"
        icon="key-outline"
        disabled={busy}
        onPress={() => setConfirming("reset")}
      />
      <Button
        label="Remove from committee"
        variant="danger"
        icon="person-remove-outline"
        disabled={busy}
        onPress={() => setConfirming("remove")}
      />
      <Button label="Close" variant="ghost" onPress={onClose} disabled={busy} />
    </Sheet>
  );
}

/** One line per role, from the capability table in integration doc §3. */
const ROLE_SUMMARY: Record<Role, string> = {
  ADMIN: "Full register, Aadhaar images, licence transfers, deletions and the committee.",
  COLLECTOR: "Registers and edits shops and members, and captures photos and Aadhaar copies.",
  VIEWER: "Read-only. Cannot add or change anything, or open Aadhaar images."
};

const styles = StyleSheet.create({
  mono: { ...typography.mono, fontSize: 13, color: colors.muted },
  block: { gap: spacing.xs }
});
