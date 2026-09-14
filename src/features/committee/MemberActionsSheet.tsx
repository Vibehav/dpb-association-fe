import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, isCode, type CommitteeMember, type Role } from "../../api";
import { Banner, Button, Chip, ChipRow, Field, Sheet } from "../../components/ui";
import { colors, spacing, typography } from "../../theme";
import { titleCase } from "../../utils/format";
import { formatPhone } from "../../utils/phone";
import { firstError, validateEmail, validateName } from "../../utils/validators";
import { useRemoveCommitteeMember, useResetPin, useUpdateCommitteeMember } from "./hooks";

const ROLES: Role[] = ["ADMIN", "COLLECTOR", "VIEWER"];

type Props = {
  member: CommitteeMember | null;
  isSelf: boolean;
  onClose: () => void;
};

/**
 * Correct a member's name/email, change their role, reset their M-PIN, or remove them.
 *
 * Confirmation happens *inside* this sheet rather than in a second one — nesting RN
 * `Modal`s is unreliable, and a two-state sheet reads better anyway.
 *
 * A signed-in admin can edit their own name/email so a typo cannot lock them out of email
 * OTPs. Their own role, PIN and membership still require another admin.
 */
export function MemberActionsSheet({ member, isSelf, onClose }: Props) {
  const update = useUpdateCommitteeMember();
  const resetPin = useResetPin();
  const remove = useRemoveCommitteeMember();

  const [confirming, setConfirming] = useState<"reset" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("COLLECTOR");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Reset the sheet's internal state whenever it targets someone new.
  useEffect(() => {
    setConfirming(null);
    setError(null);
    setEmailError(null);
    setName(member?.name ?? "");
    setEmail(member?.email ?? "");
    setSelectedRole(member?.role ?? "COLLECTOR");
  }, [member?.id, member?.name, member?.email, member?.role]);

  if (!member) return null;
  const target = member;

  const busy = update.isPending || resetPin.isPending || remove.isPending;

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

  async function saveDetails() {
    const message = firstError(validateName(name), validateEmail(email));
    setError(message);
    setEmailError(null);
    if (message) return;

    const body = {
      ...(name.trim() !== target.name ? { name: name.trim() } : {}),
      ...(email.trim() !== target.email ? { email: email.trim() } : {}),
      ...(!isSelf && selectedRole !== target.role ? { role: selectedRole } : {})
    };
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    setError(null);
    try {
      await update.mutateAsync({ id: target.id, body });
      onClose();
    } catch (caught) {
      if (isCode(caught, "duplicate_email")) {
        setEmailError("This email is already used by another active committee member.");
      } else {
        setError(errorMessage(caught));
      }
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
        <Text style={typography.eyebrow}>Member details</Text>
        <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="characters" />
        <Field
          label="Email address"
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setEmailError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          error={emailError}
        />
      </View>

      <View style={styles.block}>
        <Text style={typography.eyebrow}>Role</Text>
        <ChipRow>
          {ROLES.map((role) => (
            <Chip
              key={role}
              label={titleCase(role)}
              selected={selectedRole === role}
              onPress={() => setSelectedRole(role)}
              disabled={isSelf}
            />
          ))}
        </ChipRow>
      </View>

      {!member.pinSet ? (
        <Banner tone="notice" message="They haven't set an M-PIN yet — they will on first sign-in." />
      ) : null}

      {error ? <Banner message={error} /> : null}

      {!isSelf ? (
        <>
          <Button
            label="Remove from committee"
            variant="secondary"
            icon="person-remove-outline"
            disabled={busy}
            onPress={() => setConfirming("remove")}
          />
          <Button
            label="Reset M-PIN"
            variant="secondary"
            icon="key-outline"
            disabled={busy}
            onPress={() => setConfirming("reset")}
          />
        </>
      ) : null}
      <View style={styles.bottomActions}>
        <View style={styles.bottomAction}>
          <Button label="Save" variant="primary" loading={update.isPending} onPress={saveDetails} />
        </View>
        <View style={styles.bottomAction}>
          <Button label="Close" variant="secondary" onPress={onClose} disabled={busy} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  mono: { ...typography.mono, fontSize: 13, color: colors.muted },
  block: { gap: spacing.xs },
  bottomActions: { flexDirection: "row", gap: spacing.sm },
  bottomAction: { flex: 1 }
});
