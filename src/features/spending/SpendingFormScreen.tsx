import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import {
  errorMessage,
  isCode,
  PAYMENT_MODES,
  type CreateSpendingRequest,
  type Fund,
  type PaymentMode
} from "../../api";
import { ImageCaptureField } from "../../components/media/ImageCaptureField";
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmSheet,
  DateField,
  ErrorState,
  Field,
  LoadingScreen,
  Screen
} from "../../components/ui";
import { useImageCapture } from "../../media";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { formatMoney, paymentModeLabel, todayIso } from "../../utils/format";
import { useEvent } from "../events/hooks";
import { useRecordSpending } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "SpendingForm">;

/**
 * Add spending (spec §6.9, §6.10) — admin only.
 *
 * With an `eventId` the bill is for that event; without, it is a general-fund running cost.
 * Which fund pays:
 * - an **own-fund** event asks — Event fund or General fund — and the server requires the
 *   answer;
 * - a **general-funded** event, or no event, is always the general fund, so nothing is asked.
 *
 * No spending may take a fund below ₹0. When an event's fund can't cover the whole bill the
 * server answers 409 `event_fund_short` with a split offer ("…confirm to pay ₹10,000 from it
 * and the remaining ₹5,000 from the general fund"); confirming resends with
 * `splitToGeneral: true` and saves two entries together.
 */
export function SpendingFormScreen({ navigation, route }: Props) {
  const eventId = route.params?.eventId;
  const event = useEvent(eventId);
  const record = useRecordSpending();
  const bill = useImageCapture("BILL");

  const [paidFrom, setPaidFrom] = useState<Fund>("EVENT");
  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [spentOn, setSpentOn] = useState<string | null>(todayIso());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The server's split offer, waiting for a yes. */
  const [splitOffer, setSplitOffer] = useState<string | null>(null);

  if (eventId !== undefined && event.isPending) return <LoadingScreen />;
  if (eventId !== undefined && (event.error || !event.data)) {
    return (
      <Screen>
        <ErrorState error={event.error} title="Couldn't load the event" onRetry={event.refetch} />
      </Screen>
    );
  }

  const e = event.data;
  const ownFundEvent = Boolean(e?.ownFund);
  const closed = e?.status === "CLOSED";

  async function submit(splitToGeneral: boolean) {
    setError(null);
    if (!title.trim()) {
      setError("Say what it was for.");
      return;
    }
    if (!/^\d+$/.test(amount.trim()) || Number(amount) <= 0) {
      setError("Enter the amount in whole rupees.");
      return;
    }
    if (bill.busy) {
      setError("Wait for the bill photo to finish uploading.");
      return;
    }
    if (bill.state.status === "failed" && bill.previewUri) {
      setError("The bill photo didn't upload — retry it, or remove it and attach it later.");
      return;
    }

    const body: CreateSpendingRequest = { title: title.trim(), amount: Number(amount), paymentMode: mode };
    if (vendor.trim()) body.vendor = vendor.trim();
    if (spentOn) body.spentOn = spentOn;
    if (notes.trim()) body.notes = notes.trim();
    if (bill.key) body.billKey = bill.key;
    if (eventId !== undefined) body.eventId = eventId;
    // Only an own-fund event asks; for the rest the server knows it is the general fund.
    if (ownFundEvent) body.paidFrom = paidFrom;
    if (splitToGeneral) body.splitToGeneral = true;

    try {
      await record.mutateAsync(body);
      setSplitOffer(null);
      navigation.goBack();
    } catch (caught) {
      setSplitOffer(null);
      // Something is left in the event's fund → the message is a split offer to confirm.
      // Nothing left → it says to pay from the general fund instead; nothing to confirm.
      if (isCode(caught, "event_fund_short") && !splitToGeneral && (e?.balance ?? 0) > 0) {
        setSplitOffer(caught.message);
        return;
      }
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={typography.eyebrow}>{e ? e.name : "General fund"}</Text>
        {ownFundEvent ? (
          <>
            <Text style={typography.eyebrow}>Paid from</Text>
            <ChipRow>
              <Chip label="Event fund" selected={paidFrom === "EVENT"} onPress={() => setPaidFrom("EVENT")} />
              <Chip label="General fund" selected={paidFrom === "GENERAL"} onPress={() => setPaidFrom("GENERAL")} />
            </ChipRow>
            <Text style={typography.bodySmall}>
              {paidFrom === "GENERAL"
                ? "Deducted from the general fund and shown here as event support — the event fund is untouched."
                : `Deducted from this event's own collection${e?.balance != null ? ` (${formatMoney(e.balance)} left)` : ""}.`}
            </Text>
          </>
        ) : e ? (
          <Text style={typography.bodySmall}>This event has no fund of its own — the spending is paid from the general fund.</Text>
        ) : (
          <Text style={typography.bodySmall}>A running cost, paid from the general fund.</Text>
        )}
      </Card>

      {closed ? <Banner tone="notice" message={`${e?.name} is closed · nothing further can be added.`} /> : null}

      <Field label="What was it for?" value={title} onChangeText={setTitle} placeholder="Mandap & stage decoration" />
      <Field label="Paid to (optional)" value={vendor} onChangeText={setVendor} placeholder="Vendor" />
      <Field
        label="Amount (₹)"
        value={amount}
        onChangeText={(next) => setAmount(next.replace(/\D/g, ""))}
        keyboardType="number-pad"
        placeholder="0"
        style={styles.amountInput}
      />
      <Text style={typography.eyebrow}>Payment mode</Text>
      <ChipRow>
        {PAYMENT_MODES.map((value) => (
          <Chip key={value} label={paymentModeLabel(value)} selected={mode === value} onPress={() => setMode(value)} />
        ))}
      </ChipRow>
      <DateField label="Paid on" value={spentOn} onChange={setSpentOn} maximumDate={todayIso()} />
      <ImageCaptureField label="Bill photo (optional)" capture={bill} type="BILL" note="Can also be attached later." />
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Cheque no., remarks" multiline />

      {error ? <Banner message={error} /> : null}
      <Button label="Save spending" loading={record.isPending} disabled={closed} onPress={() => submit(false)} />
      <Button label="Cancel" variant="secondary" disabled={record.isPending} onPress={() => navigation.goBack()} />

      <ConfirmSheet
        visible={splitOffer !== null}
        onClose={() => setSplitOffer(null)}
        onConfirm={() => submit(true)}
        loading={record.isPending}
        title="Pay from both funds?"
        message={splitOffer ?? ""}
        confirmLabel="Split it"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountInput: { fontSize: 26, minHeight: 56 }
});
