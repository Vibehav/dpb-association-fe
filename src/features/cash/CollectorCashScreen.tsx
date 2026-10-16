import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage } from "../../api";
import { Banner, Button, Card, ErrorState, Field, LoadingScreen, Screen, Sheet } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { formatDateTime, formatMoney } from "../../utils/format";
import { Figure, FigureRow } from "../money/components/Figures";
import { HandoverRow } from "./components/HandoverRow";
import { useCollectorCash, useSettle } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "CollectorCash">;

/**
 * One collector's cash account — admin only. Their figures, every handover and settlement, and
 * **Settle** when something is left: the collector bringing what was short, or the treasurer
 * giving back what was extra. The direction follows the sign; it is never asked.
 */
export function CollectorCashScreen({ navigation, route }: Props) {
  const { collectorId } = route.params;
  const account = useCollectorCash(collectorId);
  useRefreshOnFocus(account.refetch);
  const settle = useSettle(collectorId);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (account.isPending) return <LoadingScreen />;
  if (account.error || !account.data) {
    return (
      <Screen>
        <ErrorState error={account.error} title="Couldn't load the collector" onRetry={account.refetch} />
      </Screen>
    );
  }
  const { figures: f, handovers, settlements } = account.data;
  const short = f.outstanding > 0;

  function startSettle() {
    setAmount(String(Math.abs(f.outstanding)));
    setNote("");
    setError(null);
    setOpen(true);
  }

  async function save() {
    setError(null);
    if (!/^\d+$/.test(amount.trim()) || Number(amount) <= 0) {
      setError("Enter the amount in whole rupees.");
      return;
    }
    if (!note.trim()) {
      setError("Add a note — it goes on the record.");
      return;
    }
    try {
      await settle.mutateAsync({
        direction: short ? "COLLECTOR_PAID" : "TREASURER_RETURNED",
        amount: Number(amount),
        note: note.trim()
      });
      setOpen(false);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen refreshing={account.isRefetching} onRefresh={account.refetch}>
      <Card>
        <Text style={typography.title}>{f.name}</Text>
        <FigureRow>
          <Figure label="In hand" value={f.cashWithYou} />
          <Figure label="Waiting" value={f.inTransit} />
          <Figure label="To settle" value={f.outstanding} />
        </FigureRow>
        {f.outstanding > 0 ? <Text style={typography.bodySmall}>{formatMoney(f.outstanding)} short from earlier handovers.</Text> : null}
        {f.outstanding < 0 ? (
          <Text style={typography.bodySmall}>The treasurer holds {formatMoney(-f.outstanding)} more than their receipts.</Text>
        ) : null}
      </Card>
      {f.outstanding !== 0 ? (
        <Button
          label={short ? "Record cash brought in" : "Record cash given back"}
          icon="swap-horizontal-outline"
          onPress={startSettle}
        />
      ) : null}

      <Text style={typography.eyebrow}>Handovers</Text>
      {handovers.length === 0 ? <Text style={typography.bodySmall}>No handovers yet.</Text> : null}
      {handovers.map((h) => (
        <HandoverRow key={h.id} handover={h} onPress={() => navigation.navigate("Handover", { handoverId: h.id })} />
      ))}

      {settlements.length > 0 ? <Text style={typography.eyebrow}>Settlements</Text> : null}
      {settlements.map((s) => (
        <Card key={s.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={typography.body}>{s.direction === "COLLECTOR_PAID" ? "Brought in by the collector" : "Given back by the treasurer"}</Text>
              <Text style={typography.bodySmall}>
                {formatDateTime(s.at)}
                {s.byName ? ` · ${s.byName}` : ""} · {s.note}
              </Text>
            </View>
            <Text style={styles.mono}>{formatMoney(s.amount)}</Text>
          </View>
        </Card>
      ))}

      <Sheet visible={open} onClose={() => setOpen(false)} title={short ? "Cash brought in" : "Cash given back"}>
        <Text style={typography.bodySmall}>
          {short
            ? `${f.name} is short by ${formatMoney(f.outstanding)}. Record what they brought.`
            : `You hold ${formatMoney(-f.outstanding)} more than ${f.name}'s receipts. Record what you gave back.`}
        </Text>
        <Field label="Amount (₹)" value={amount} onChangeText={(next) => setAmount(next.replace(/\D/g, ""))} keyboardType="number-pad" />
        <Field label="Note" value={note} onChangeText={setNote} placeholder={short ? "Brought the ₹200" : "Gave back the ₹100"} />
        {error ? <Banner message={error} /> : null}
        <Button label="Save" loading={settle.isPending} onPress={save} />
        <Button label="Cancel" variant="ghost" disabled={settle.isPending} onPress={() => setOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 14 }
});
