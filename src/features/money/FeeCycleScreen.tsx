import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, type FeeCycle } from "../../api";
import { Banner, Button, Card, ConfirmSheet, ErrorState, Field, LoadingScreen, Screen } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { colors, spacing, typography } from "../../theme";
import { formatDate, formatMoney } from "../../utils/format";
import {
  useCloseFeeCycle,
  useCreateFeeCycle,
  useCurrentFeeCycle,
  useFeeCycleHistory,
  useRaiseDemand,
  useUpdateFeeCycle
} from "./hooks";

/**
 * The annual fee year (spec §9) — admin only.
 *
 * Set the amount the general body meeting decided, raise the demand against every shop, and
 * close the year. Closing writes nothing off: whatever is still due becomes arrears, and stays
 * collectable from each shop's screen.
 */
export function FeeCycleScreen() {
  const current = useCurrentFeeCycle();
  const history = useFeeCycleHistory();

  async function refresh() {
    await Promise.all([current.refetch(), history.refetch()]);
  }
  useRefreshOnFocus(refresh);

  if (current.isPending) return <LoadingScreen />;
  if (current.error) {
    return (
      <Screen>
        <ErrorState error={current.error} title="Couldn't load the fee year" onRetry={current.refetch} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={current.isRefetching || history.isRefetching} onRefresh={refresh}>
      {current.data ? <OpenYear cycle={current.data} /> : <NewYear />}

      <Card>
        <Text style={typography.eyebrow}>Closed years</Text>
        {(history.data ?? []).length === 0 ? (
          <Text style={typography.body}>No closed years yet.</Text>
        ) : (
          history.data?.map((year) => (
            <View key={year.id} style={styles.historyRow}>
              <View style={styles.flex}>
                <Text style={typography.cardTitle}>{year.yearLabel}</Text>
                <Text style={typography.bodySmall}>
                  {formatMoney(year.amount)} per shop · closed {formatDate(year.closedAt)}
                </Text>
              </View>
              <Text style={styles.mono}>{formatMoney(year.collected)}</Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

/** No year open: set this year's fee. Nothing is collectable for the fee until then. */
function NewYear() {
  const create = useCreateFeeCycle();
  const [yearLabel, setYearLabel] = useState(suggestedYearLabel());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    if (!/^\d{4}-\d{2}$/.test(yearLabel.trim())) {
      setError("The year must look like 2026-27.");
      return;
    }
    if (!/^\d+$/.test(amount) || Number(amount) <= 0) {
      setError("Enter the fee in whole rupees.");
      return;
    }
    try {
      await create.mutateAsync({
        yearLabel: yearLabel.trim(),
        amount: Number(amount),
        ...(note.trim() ? { meetingNote: note.trim() } : {})
      });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Card>
      <Text style={typography.eyebrow}>No fee year open</Text>
      <Text style={typography.body}>
        Set the fee the general body meeting decided — one amount for every shop. Then raise the
        demand so collectors can start.
      </Text>
      <Field label="Year" value={yearLabel} onChangeText={setYearLabel} placeholder="2026-27" />
      <Field
        label="Fee per shop (₹)"
        value={amount}
        onChangeText={(next) => setAmount(next.replace(/\D/g, ""))}
        keyboardType="number-pad"
      />
      <Field label="Decided at" value={note} onChangeText={setNote} placeholder="General body meeting, 12 Mar 2026" />
      {error ? <Banner message={error} /> : null}
      <Button label="Set the fee" loading={create.isPending} onPress={onCreate} />
    </Card>
  );
}

function OpenYear({ cycle }: { cycle: FeeCycle }) {
  const update = useUpdateFeeCycle(cycle.id);
  const raise = useRaiseDemand(cycle.id);
  const close = useCloseFeeCycle(cycle.id);

  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(cycle.amount));
  const [note, setNote] = useState(cycle.meetingNote ?? "");
  const [confirm, setConfirm] = useState<"raise" | "close" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setConfirm(null);
    } catch (caught) {
      setConfirm(null);
      setError(errorMessage(caught));
    }
  }

  async function onSave() {
    if (!/^\d+$/.test(amount) || Number(amount) <= 0) {
      setError("Enter the fee in whole rupees.");
      return;
    }
    await run(async () => {
      const changed = Number(amount) !== cycle.amount;
      const result = await update.mutateAsync({
        ...(changed ? { amount: Number(amount) } : {}),
        ...(note.trim() ? { meetingNote: note.trim() } : {})
      });
      setEditing(false);
      if (changed) {
        // Shops that have paid anything keep their price — their receipts were issued on it.
        setNotice(
          `${result.demandsUpdated} unpaid ${result.demandsUpdated === 1 ? "demand" : "demands"} updated to ${formatMoney(result.amount)}.`
        );
      }
    });
  }

  return (
    <>
      <Card>
        <Text style={typography.eyebrow}>Fee for {cycle.yearLabel}</Text>
        <Text style={styles.big}>{formatMoney(cycle.amount)}</Text>
        {cycle.meetingNote ? <Text style={typography.bodySmall}>{cycle.meetingNote}</Text> : null}
        <Text style={typography.body}>
          {cycle.demandRaised
            ? `Demand raised on ${formatDate(cycle.demandRaisedAt)}.`
            : `Not raised yet — no shop owes anything for ${cycle.yearLabel}.`}
        </Text>

        {editing ? (
          <>
            <Field
              label="Fee per shop (₹)"
              value={amount}
              onChangeText={(next) => setAmount(next.replace(/\D/g, ""))}
              keyboardType="number-pad"
              hint="Shops that have paid anything keep their current price."
            />
            <Field label="Decided at" value={note} onChangeText={setNote} />
            <Button label="Save" loading={update.isPending} onPress={onSave} />
            <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          </>
        ) : (
          <Button label="Change amount or note" variant="secondary" icon="create-outline" onPress={() => setEditing(true)} />
        )}
      </Card>

      {cycle.demandRaised ? (
        <Card>
          <Text style={typography.eyebrow}>Collection so far</Text>
          <Row label="Paid in full" value={`${cycle.shopsPaid} shops`} />
          <Row label="Part paid" value={`${cycle.shopsPartial} shops · ${formatMoney(cycle.partialDue)} due`} />
          <Row label="Nothing paid yet" value={`${cycle.shopsPending} shops · ${formatMoney(cycle.pendingAmount)}`} />
          <Row label="Collected" value={formatMoney(cycle.collected)} />
        </Card>
      ) : null}

      {notice ? <Banner tone="success" message={notice} /> : null}
      {error ? <Banner message={error} /> : null}

      {!cycle.demandRaised ? (
        <Button label="Raise the demand" icon="megaphone-outline" onPress={() => setConfirm("raise")} />
      ) : null}
      <Button label={`Close ${cycle.yearLabel}`} variant="danger" icon="lock-closed-outline" onPress={() => setConfirm("close")} />

      <ConfirmSheet
        visible={confirm === "raise"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(() => raise.mutateAsync())}
        loading={raise.isPending}
        title={`Raise the ${cycle.yearLabel} demand?`}
        message={`Every shop on record will owe ${formatMoney(cycle.amount)} for ${cycle.yearLabel}, and collectors can start collecting. Shops registered later are charged when they are registered.`}
        confirmLabel="Raise the demand"
      />
      <ConfirmSheet
        visible={confirm === "close"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(() => close.mutateAsync())}
        loading={close.isPending}
        destructive
        title={`Close ${cycle.yearLabel}?`}
        message={`Whatever is still due becomes arrears — collectable later from each shop's screen. The ${cycle.yearLabel} fee can't be collected as this year's any more, and the next year must be set before anything new is due.`}
        confirmLabel={`Close ${cycle.yearLabel}`}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.historyRow}>
      <Text style={[typography.body, styles.flex]}>{label}</Text>
      <Text style={styles.mono}>{value}</Text>
    </View>
  );
}

/** The financial year we are in, India time: 1 April starts a new one. */
function suggestedYearLabel(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  big: { ...typography.display, fontSize: 30 },
  flex: { flex: 1 },
  mono: { ...typography.mono, fontSize: 13 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  }
});
