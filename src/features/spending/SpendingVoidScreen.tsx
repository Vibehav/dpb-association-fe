import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Text } from "react-native";
import { errorMessage, VOID_REASONS, type VoidReason } from "../../api";
import { Banner, Button, Card, Chip, ChipRow, ErrorState, Field, LoadingScreen, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { formatMoney, voidReasonLabel } from "../../utils/format";
import { useSpending, useVoidSpending } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "SpendingVoid">;

/**
 * Void a spending — admin only, never a delete. The entry stays listed, struck through, with
 * the reason and your name, and stops counting in every total. A reason is mandatory.
 */
export function SpendingVoidScreen({ navigation, route }: Props) {
  const { spendingId } = route.params;
  const spending = useSpending(spendingId);
  const voidIt = useVoidSpending(spendingId);
  const [reason, setReason] = useState<VoidReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (spending.isPending) return <LoadingScreen />;
  if (spending.error || !spending.data) {
    return (
      <Screen>
        <ErrorState error={spending.error} title="Couldn't load the spending" onRetry={spending.refetch} />
      </Screen>
    );
  }
  const s = spending.data;

  async function submit() {
    setError(null);
    if (!reason) {
      setError("Pick a reason — it goes on the record.");
      return;
    }
    try {
      await voidIt.mutateAsync({ reason, ...(note.trim() ? { note: note.trim() } : {}) });
      navigation.goBack();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={typography.cardTitle}>
          {s.title} · {formatMoney(s.amount)}
        </Text>
        <Text style={typography.bodySmall}>
          The entry stays on record, struck through, with your name and the reason — and stops counting in every
          total. To fix an amount, date or fund, add the right entry again afterwards.
        </Text>
      </Card>
      <Text style={typography.eyebrow}>Reason</Text>
      <ChipRow>
        {VOID_REASONS.map((value) => (
          <Chip key={value} label={voidReasonLabel(value)} selected={reason === value} onPress={() => setReason(value)} />
        ))}
      </ChipRow>
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="What happened" />
      {error ? <Banner message={error} /> : null}
      <Button label="Void this spending" variant="danger" loading={voidIt.isPending} onPress={submit} />
      <Button label="Keep it" variant="secondary" disabled={voidIt.isPending} onPress={() => navigation.goBack()} />
    </Screen>
  );
}
