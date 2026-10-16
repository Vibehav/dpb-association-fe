import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { errorMessage } from "../../api";
import { Banner, Button, Card, DateField, ErrorState, Field, LoadingScreen, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { formatDate, formatDateTime, formatMoney, todayIso } from "../../utils/format";
import { useFundSummary, useSetOpeningBalance, useVoidOpeningBalance } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "OpeningBalance">;

/**
 * The general fund's opening balance — admin only.
 *
 * What the association already held when it started using the app, entered once so the
 * app's balance matches the bank. Without it, "no spending below ₹0" would refuse a bill paid
 * out of that older money. A wrong figure is never edited: it is voided, with a note, and
 * entered again.
 */
export function OpeningBalanceScreen({ navigation }: Props) {
  const summary = useFundSummary();
  const set = useSetOpeningBalance();
  const voidIt = useVoidOpeningBalance();
  const [amount, setAmount] = useState("");
  const [asOn, setAsOn] = useState<string | null>(todayIso());
  const [note, setNote] = useState("");
  const [voidNote, setVoidNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (summary.isPending) return <LoadingScreen />;
  if (summary.error || !summary.data) {
    return (
      <Screen>
        <ErrorState error={summary.error} title="Couldn't load the general fund" onRetry={summary.refetch} />
      </Screen>
    );
  }
  const current = summary.data.openingBalance;

  async function save() {
    setError(null);
    if (!/^\d+$/.test(amount.trim()) || Number(amount) <= 0) {
      setError("Enter the amount in whole rupees.");
      return;
    }
    if (!asOn) {
      setError("Choose the date it was held on.");
      return;
    }
    try {
      await set.mutateAsync({ amount: Number(amount), asOn, ...(note.trim() ? { note: note.trim() } : {}) });
      navigation.goBack();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function voidCurrent() {
    setError(null);
    if (!voidNote.trim()) {
      setError("Say why it is being voided — it goes on the record.");
      return;
    }
    try {
      await voidIt.mutateAsync(voidNote.trim());
      setVoidNote("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (current) {
    return (
      <Screen>
        <Card>
          <Text style={typography.eyebrow}>Opening balance</Text>
          <Text style={styles.big}>{formatMoney(current.amount)}</Text>
          <Text style={typography.body}>As on {formatDate(current.asOn)}</Text>
          {current.note ? <Text style={typography.bodySmall}>{current.note}</Text> : null}
          <Text style={typography.bodySmall}>
            Entered{current.enteredByName ? ` by ${current.enteredByName}` : ""} on {formatDateTime(current.enteredAt)}
          </Text>
        </Card>
        <Card>
          <Text style={typography.eyebrow}>Wrong figure?</Text>
          <Text style={typography.bodySmall}>
            Void it, then enter the right one. The voided figure stays on record with your note.
          </Text>
          <Field label="Why" value={voidNote} onChangeText={setVoidNote} placeholder="Used the wrong statement" />
          <Button label="Void opening balance" variant="danger" loading={voidIt.isPending} onPress={voidCurrent} />
        </Card>
        {error ? <Banner message={error} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={typography.body}>
        Enter what the association already held when it started using the app, so the balance matches the bank.
      </Text>
      <Field
        label="Amount (₹)"
        value={amount}
        onChangeText={(next) => setAmount(next.replace(/\D/g, ""))}
        keyboardType="number-pad"
        placeholder="0"
        style={styles.amountInput}
      />
      <DateField label="As on" value={asOn} onChange={setAsOn} maximumDate={todayIso()} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Bank balance on 1 April" />
      {error ? <Banner message={error} /> : null}
      <Button label="Save opening balance" loading={set.isPending} onPress={save} />
      <Button label="Cancel" variant="secondary" disabled={set.isPending} onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { ...typography.display, fontSize: 32 },
  amountInput: { fontSize: 26, minHeight: 56 }
});
