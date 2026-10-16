import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { CANCEL_REASONS, errorMessage, isCode, type CancelReason } from "../../api";
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmSheet,
  ErrorState,
  Field,
  LoadingScreen,
  Screen
} from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { cancelReasonLabel, formatMoney } from "../../utils/format";
import { useCancelReceipt, useCorrectReceipt, useReceipt } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "ReceiptAction">;

/**
 * Cancel or correct a receipt (spec §11) — admin only; the server refuses anyone else.
 *
 * Nothing is edited. Cancelling strikes the receipt through and drops it from every total;
 * correcting cancels it and issues a **new** receipt with the next number. Only the amount can
 * be corrected — a wrong payer is a cancel and a fresh collection. A reason is mandatory.
 *
 * A fee correction is checked like a collection, so a short corrected amount asks the same
 * part-payment question when the server answers 409 `part_payment_unconfirmed`.
 */
export function ReceiptActionScreen({ navigation, route }: Props) {
  const { contributionId, mode } = route.params;
  const receipt = useReceipt(contributionId);
  const cancel = useCancelReceipt(contributionId);
  const correct = useCorrectReceipt(contributionId);

  const [reason, setReason] = useState<CancelReason | null>(null);
  const [note, setNote] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmPart, setConfirmPart] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: mode === "cancel" ? "Cancel receipt" : "Correct receipt" });
  }, [navigation, mode]);

  useEffect(() => {
    if (receipt.data && newAmount === "") setNewAmount(String(receipt.data.amount));
  }, [receipt.data, newAmount]);

  if (receipt.isPending) return <LoadingScreen />;
  if (receipt.error || !receipt.data) {
    return (
      <Screen>
        <ErrorState error={receipt.error} title="Couldn't load the receipt" onRetry={receipt.refetch} />
      </Screen>
    );
  }

  const r = receipt.data;
  const busy = cancel.isPending || correct.isPending;

  async function submit(confirmPartPayment: boolean) {
    setError(null);
    if (!reason) {
      setError("Pick a reason — it goes on the record.");
      return;
    }
    const trimmedNote = note.trim() || undefined;
    try {
      if (mode === "cancel") {
        await cancel.mutateAsync({ reason, note: trimmedNote });
        navigation.goBack();
        return;
      }
      if (!/^\d+$/.test(newAmount) || Number(newAmount) <= 0) {
        setError("Enter the corrected amount in whole rupees.");
        return;
      }
      const replacement = await correct.mutateAsync({
        reason,
        note: trimmedNote,
        newAmount: Number(newAmount),
        ...(confirmPartPayment ? { confirmPartPayment: true } : {})
      });
      setConfirmPart(null);
      // The original (now cancelled) stays underneath; the new receipt takes this screen's place.
      navigation.replace("Receipt", { contributionId: replacement.id });
    } catch (caught) {
      if (isCode(caught, "part_payment_unconfirmed")) {
        setConfirmPart(caught.message);
        return;
      }
      setConfirmPart(null);
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={typography.cardTitle}>
          {r.receiptNo} · {r.payer.name}
        </Text>
        <Text style={typography.body}>
          {r.purposeLabel} · {formatMoney(r.amount)}
        </Text>
        <Text style={typography.bodySmall}>
          {mode === "cancel"
            ? "The receipt number is never reused. The entry stays on record, struck through, with your name and the reason — and stops counting in every total."
            : "The old receipt is cancelled and a new one is issued with the next number, noting that it replaces this one."}
        </Text>
      </Card>

      {mode === "correct" ? (
        <Field
          label="Corrected amount (₹)"
          value={newAmount}
          onChangeText={(next) => setNewAmount(next.replace(/\D/g, ""))}
          keyboardType="number-pad"
        />
      ) : null}

      <Text style={typography.eyebrow}>Reason</Text>
      <ChipRow>
        {CANCEL_REASONS.map((value) => (
          <Chip key={value} label={cancelReasonLabel(value)} selected={reason === value} onPress={() => setReason(value)} />
        ))}
      </ChipRow>
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="What happened" />

      {error ? <Banner message={error} /> : null}

      <Button
        label={mode === "cancel" ? "Cancel this receipt" : "Issue corrected receipt"}
        variant={mode === "cancel" ? "danger" : "primary"}
        loading={busy}
        onPress={() => submit(false)}
      />
      <Button label="Keep it" variant="secondary" disabled={busy} onPress={() => navigation.goBack()} />

      <ConfirmSheet
        visible={confirmPart !== null}
        onClose={() => setConfirmPart(null)}
        onConfirm={() => submit(true)}
        loading={busy}
        title="Part payment?"
        message={confirmPart ?? ""}
        confirmLabel="Record part payment"
      />
    </Screen>
  );
}
