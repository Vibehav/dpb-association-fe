import { useEffect, useState } from "react";
import { Text } from "react-native";
import { errorMessage, type Handover } from "../../../api";
import { Banner, Button, Field, Sheet } from "../../../components/ui";
import { typography } from "../../../theme";
import { formatMoney } from "../../../utils/format";
import { useReceiveHandover } from "../hooks";

/**
 * The treasurer's count of one handover. "Received ₹X" is the one-tap case; otherwise the amount
 * actually counted, with a note — less leaves the collector short, more leaves the treasurer
 * holding extra, and the server keeps the difference on the collector's account.
 */
export function ReceiveSheet({ handover, onClose }: { handover: Handover | null; onClose: () => void }) {
  const receive = useReceiveHandover();
  const [different, setDifferent] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDifferent(false);
    setAmount(handover ? String(handover.expected) : "");
    setNote("");
    setError(null);
  }, [handover]);

  if (!handover) return null;
  const h = handover;

  async function save(counted: number, withNote?: string) {
    setError(null);
    try {
      await receive.mutateAsync({ id: h.id, body: { countedAmount: counted, ...(withNote ? { note: withNote } : {}) } });
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function saveDifferent() {
    if (!/^\d+$/.test(amount.trim())) {
      setError("Enter the amount counted in whole rupees.");
      return;
    }
    if (Number(amount) !== h.expected && !note.trim()) {
      setError("Add a note saying why the count differs.");
      return;
    }
    save(Number(amount), note.trim() || undefined);
  }

  return (
    <Sheet visible onClose={onClose} title={`${h.collectorName ?? "Collector"} · ${formatMoney(h.expected)}`}>
      <Text style={typography.bodySmall}>
        {h.liveReceiptCount} cash {h.liveReceiptCount === 1 ? "receipt" : "receipts"}
        {h.filedAmount !== h.expected ? ` · ${formatMoney(h.filedAmount)} when handed over` : ""}
      </Text>
      {!different ? (
        <>
          <Button label={`Received ${formatMoney(h.expected)}`} loading={receive.isPending} onPress={() => save(h.expected)} />
          <Button label="Counted a different amount" variant="secondary" onPress={() => setDifferent(true)} />
        </>
      ) : (
        <>
          <Field
            label="Amount counted (₹)"
            value={amount}
            onChangeText={(next) => setAmount(next.replace(/\D/g, ""))}
            keyboardType="number-pad"
          />
          <Field label="Note" value={note} onChangeText={setNote} placeholder="₹200 missing" />
          <Button label="Save the count" loading={receive.isPending} onPress={saveDifferent} />
        </>
      )}
      {error ? <Banner message={error} /> : null}
      <Button label="Cancel" variant="ghost" disabled={receive.isPending} onPress={onClose} />
    </Sheet>
  );
}
