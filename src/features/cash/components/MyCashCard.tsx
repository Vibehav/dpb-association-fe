import { useState } from "react";
import { Text } from "react-native";
import { errorMessage } from "../../../api";
import { Banner, Button, Card, ConfirmSheet } from "../../../components/ui";
import { typography } from "../../../theme";
import { formatDateTime, formatMoney } from "../../../utils/format";
import { useHandOver, useMyCash, useWithdrawHandover } from "../hooks";

/**
 * "Cash with you" on a collector's Account (spec §8): what they hold, the handover waiting for the
 * treasurer, and anything left from an earlier one. Renders nothing when all of it is empty — and
 * for an admin, whose cash is the treasury's and who always gets zeros.
 */
export function MyCashCard() {
  const cash = useMyCash(true);
  const handOver = useHandOver();
  const withdraw = useWithdrawHandover();
  const [sheet, setSheet] = useState<"handOver" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const c = cash.data;
  if (!c || (c.cashWithYou === 0 && !c.pending && c.outstanding === 0)) return null;
  const pendingId = c.pending?.id;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSheet(null);
    }
  }

  return (
    <Card>
      {c.cashWithYou > 0 ? (
        <>
          <Text style={typography.eyebrow}>Cash with you</Text>
          <Text style={typography.title}>{formatMoney(c.cashWithYou)}</Text>
          <Text style={typography.bodySmall}>
            {c.receiptCount} cash {c.receiptCount === 1 ? "receipt" : "receipts"} since your last handover
          </Text>
          {!c.pending ? (
            <Button label="Hand over to the treasurer" icon="cash-outline" onPress={() => setSheet("handOver")} />
          ) : null}
        </>
      ) : null}

      {c.pending ? (
        <>
          <Text style={typography.body}>
            {formatMoney(c.pending.expected)} handed over on {formatDateTime(c.pending.filedAt)} · waiting for the
            treasurer to confirm
          </Text>
          <Button label="Withdraw" variant="secondary" onPress={() => setSheet("withdraw")} />
        </>
      ) : null}

      {c.outstanding > 0 ? (
        <Text style={typography.bodySmall}>
          {formatMoney(c.outstanding)} short from an earlier handover — settle it with the treasurer.
        </Text>
      ) : c.outstanding < 0 ? (
        <Text style={typography.bodySmall}>The treasurer holds {formatMoney(-c.outstanding)} more than your receipts.</Text>
      ) : null}

      {error ? <Banner message={error} /> : null}

      <ConfirmSheet
        visible={sheet === "handOver"}
        onClose={() => setSheet(null)}
        onConfirm={() => run(() => handOver.mutateAsync())}
        loading={handOver.isPending}
        title="Hand over cash"
        message={`You are handing the treasurer all the cash you have collected since your last handover: ${formatMoney(c.cashWithYou)}. The treasurer confirms it on their phone.`}
        confirmLabel="Mark as handed over"
      />
      <ConfirmSheet
        visible={sheet === "withdraw"}
        onClose={() => setSheet(null)}
        onConfirm={() => (pendingId === undefined ? undefined : run(() => withdraw.mutateAsync(pendingId)))}
        loading={withdraw.isPending}
        title="Withdraw the handover?"
        message="The cash counts as with you again, and you can hand it over later with anything collected since."
        confirmLabel="Withdraw it"
      />
    </Card>
  );
}
