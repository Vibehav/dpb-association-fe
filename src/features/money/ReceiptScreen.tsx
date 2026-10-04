import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import { Banner, Button, Card, ErrorState, LoadingScreen, Screen } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { openWhatsApp } from "../../utils/deviceActions";
import { cancelReasonLabel, formatDateTime, formatMoney, paymentModeLabel } from "../../utils/format";
import { StatusTag } from "./components/StatusTag";
import { useReceipt } from "./hooks";
import { receiptBalanceLine, sendReceiptPdf } from "./receiptPdf";

type Props = NativeStackScreenProps<AppStackParamList, "Receipt">;

/**
 * The receipt (spec §6.7) — also Reprint, for every role.
 *
 * Everything printed comes from the server as issued: the payer's name and line are a
 * snapshot, `purposeLabel` carries the fee year, `amountInWords` is Indian numbering, and the
 * fee balance is what was due *when this receipt was issued*. None of it is rebuilt here, so
 * every phone prints the same document.
 *
 * Admins correct or cancel from here (decided with the client: bigger targets than links on a
 * history row, and the whole receipt is in view while deciding).
 *
 * Sending: on Android the receipt is made into a PDF on the phone and WhatsApp opens in the
 * member's chat with it attached (see `receiptPdf.ts`). A cancelled receipt still sends the
 * server's cancellation notice as text — it is a notice, not a receipt.
 */
export function ReceiptScreen({ navigation, route }: Props) {
  const { contributionId } = route.params;
  const { canWrite, isAdmin } = usePermissions();
  const receipt = useReceipt(contributionId);
  useRefreshOnFocus(receipt.refetch);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (receipt.isPending) return <LoadingScreen />;
  if (receipt.error || !receipt.data) {
    return (
      <Screen>
        <ErrorState error={receipt.error} title="Couldn't load the receipt" onRetry={receipt.refetch} />
      </Screen>
    );
  }

  const r = receipt.data;
  const balanceLine = receiptBalanceLine(r);

  async function sendOnWhatsApp() {
    const phone = r.whatsappPhone as string;
    if (r.cancelled || Platform.OS !== "android") {
      openWhatsApp(phone, r.whatsappMessage);
      return;
    }
    setSendError(null);
    setSending(true);
    try {
      await sendReceiptPdf(r);
    } catch (caught) {
      setSendError(errorMessage(caught, "Couldn't open WhatsApp with the receipt."));
    } finally {
      setSending(false);
    }
  }

  function openPayer() {
    if (r.payer.type === "MEMBER") navigation.navigate("PersonProfile", { personId: r.payer.id });
    else navigation.navigate("DonorProfile", { donorId: r.payer.id });
  }

  return (
    <Screen refreshing={receipt.isRefetching} onRefresh={receipt.refetch}>
      <Card>
        <Text style={typography.title}>{r.association.name}</Text>
        <Text style={typography.bodySmall}>
          {r.association.address} · Reg. no. {r.association.registrationNo}
        </Text>

        <View style={[styles.numberRow, styles.rule]}>
          <Text style={styles.mono}>{r.receiptNo}</Text>
          <Text style={styles.mono}>{formatDateTime(r.collectedAt)}</Text>
        </View>

        {r.cancelled ? <StatusTag label="CANCELLED" tone="error" /> : null}

        <Text style={typography.eyebrow}>Received with thanks from</Text>
        <Pressable onPress={openPayer} accessibilityRole="button" accessibilityLabel={`Open ${r.payer.name}`}>
          <Text style={typography.title}>{r.payer.name}</Text>
        </Pressable>
        {r.payer.subtitle ? <Text style={typography.body}>{r.payer.subtitle}</Text> : null}

        <View style={styles.amountBox}>
          <Text style={[typography.body, styles.flex]}>{r.purposeLabel}</Text>
          <Text style={[styles.amount, r.cancelled && styles.struck]}>{formatMoney(r.amount)}</Text>
        </View>
        <Text style={typography.body}>{r.amountInWords}</Text>
        {balanceLine ? <Text style={typography.body}>{balanceLine}</Text> : null}

        <View style={styles.facts}>
          <View style={styles.flex}>
            <Text style={typography.eyebrow}>Mode</Text>
            <Text style={typography.body}>{paymentModeLabel(r.paymentMode)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={typography.eyebrow}>Collected by</Text>
            <Text style={typography.body}>{r.collectedByName ?? "—"}</Text>
          </View>
        </View>
        {r.notes ? <Text style={typography.bodySmall}>Notes: {r.notes}</Text> : null}

        {r.replacesReceiptNo ? <Text style={typography.bodySmall}>Replaces {r.replacesReceiptNo}</Text> : null}
        {r.cancelled ? (
          <Text style={styles.cancelNote}>
            Cancelled{r.cancelledByName ? ` by ${r.cancelledByName}` : ""}
            {r.cancelledAt ? ` on ${formatDateTime(r.cancelledAt)}` : ""}
            {r.cancelReason ? ` · ${cancelReasonLabel(r.cancelReason)}` : ""}
            {r.cancelNote ? ` · ${r.cancelNote}` : ""}
            {r.replacedByReceiptNo ? ` · replaced by ${r.replacedByReceiptNo}` : ""}
          </Text>
        ) : null}

        <View style={[styles.signature, styles.rule]}>
          <Text style={styles.signName}>{r.association.treasurerName}</Text>
          <Text style={typography.eyebrow}>{r.association.treasurerTitle}</Text>
        </View>
      </Card>

      {sendError ? <Banner message={sendError} /> : null}
      {r.whatsappPhone ? (
        <Button
          // For a cancelled receipt the server's text is the cancellation notice (spec §11).
          label={r.cancelled ? "Send cancellation notice on WhatsApp" : "Send receipt on WhatsApp"}
          icon="logo-whatsapp"
          loading={sending}
          onPress={sendOnWhatsApp}
        />
      ) : (
        <Text style={typography.bodySmall}>No phone number on record — show this receipt on screen instead.</Text>
      )}

      {canWrite ? (
        <Button label="New entry" variant="secondary" icon="add" onPress={() => navigation.replace("Collect")} />
      ) : null}

      {isAdmin && !r.cancelled ? (
        <Card>
          <Text style={typography.eyebrow}>Admin</Text>
          <Button
            label="Correct amount"
            variant="secondary"
            icon="create-outline"
            onPress={() => navigation.navigate("ReceiptAction", { contributionId, mode: "correct" })}
          />
          <Button
            label="Cancel receipt"
            variant="danger"
            icon="close-circle-outline"
            onPress={() => navigation.navigate("ReceiptAction", { contributionId, mode: "cancel" })}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rule: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  numberRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  mono: { ...typography.mono, fontSize: 12 },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.soft,
    borderRadius: 14,
    padding: spacing.lg,
    marginVertical: spacing.sm
  },
  flex: { flex: 1 },
  amount: { ...typography.display, fontSize: 30 },
  struck: { textDecorationLine: "line-through", color: colors.muted },
  facts: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  cancelNote: { ...typography.bodySmall, color: colors.error },
  signature: { alignItems: "flex-end", gap: 2 },
  signName: { ...typography.title, color: colors.primary, fontStyle: "italic" }
});
