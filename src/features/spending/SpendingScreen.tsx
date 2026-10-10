import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "../../api";
import { ImageCaptureField } from "../../components/media/ImageCaptureField";
import { Banner, Button, Card, ErrorState, LoadingScreen, Screen, Sheet } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { useImageCapture } from "../../media";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatDate, formatDateTime, formatMoney, paymentModeLabel, voidReasonLabel } from "../../utils/format";
import { StatusTag } from "../money/components/StatusTag";
import { useAttachBill, useBillUrl, useSpending } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "Spending">;

/**
 * One spending entry — admin only.
 *
 * The amount, date and paying fund are fixed: a mistake there is **voided** (it stays here,
 * struck through, and leaves every total) and entered again. The wording can be edited, and
 * the bill attached or replaced at any time.
 */
export function SpendingScreen({ navigation, route }: Props) {
  const { spendingId } = route.params;
  const spending = useSpending(spendingId);
  useRefreshOnFocus(spending.refetch);
  const attach = useAttachBill(spendingId);
  const capture = useImageCapture("BILL");
  const [billOpen, setBillOpen] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);

  if (spending.isPending) return <LoadingScreen />;
  if (spending.error || !spending.data) {
    return (
      <Screen>
        <ErrorState error={spending.error} title="Couldn't load the spending" onRetry={spending.refetch} />
      </Screen>
    );
  }

  const s = spending.data;
  const event = s.event;
  const paidFromLine =
    s.paidFrom === "EVENT" && s.event
      ? `Paid from the ${s.event.name} fund`
      : s.event
        ? `Paid from the general fund · event support for ${s.event.name}`
        : "Paid from the general fund";
  const changed = s.lastChangedAt !== s.recordedAt && s.lastChangedByName;

  async function saveBill() {
    if (!capture.key) return;
    setBillError(null);
    try {
      await attach.mutateAsync(capture.key);
      capture.clear();
    } catch (caught) {
      setBillError(errorMessage(caught));
    }
  }

  return (
    <Screen refreshing={spending.isRefetching} onRefresh={spending.refetch}>
      <Card>
        {s.voided ? <StatusTag label="VOIDED" tone="error" /> : null}
        <Text style={[typography.title, s.voided && styles.struck]}>{s.title}</Text>
        {s.vendor ? <Text style={typography.body}>{s.vendor}</Text> : null}
        <Text style={[styles.amount, s.voided && styles.struck]}>{formatMoney(s.amount)}</Text>

        <Text style={typography.body}>{paidFromLine}</Text>
        {event ? (
          <Pressable
            onPress={() => navigation.navigate("Event", { eventId: event.id })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${event.name}`}
          >
            <Text style={styles.link}>Open {event.name}</Text>
          </Pressable>
        ) : null}

        <View style={styles.facts}>
          <View style={styles.flex}>
            <Text style={typography.eyebrow}>Mode</Text>
            <Text style={typography.body}>{paymentModeLabel(s.paymentMode)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={typography.eyebrow}>Paid on</Text>
            <Text style={typography.body}>{formatDate(s.spentOn)}</Text>
          </View>
        </View>
        {s.notes ? <Text style={typography.bodySmall}>Notes: {s.notes}</Text> : null}
        <Text style={typography.bodySmall}>
          Recorded{s.recordedByName ? ` by ${s.recordedByName}` : ""} on {formatDateTime(s.recordedAt)}
        </Text>
        {changed ? (
          <Text style={typography.bodySmall}>
            Last changed by {s.lastChangedByName} on {formatDateTime(s.lastChangedAt)}
          </Text>
        ) : null}
        {s.voided ? (
          <Text style={styles.voidNote}>
            Voided{s.voidedByName ? ` by ${s.voidedByName}` : ""}
            {s.voidedAt ? ` on ${formatDateTime(s.voidedAt)}` : ""}
            {s.voidReason ? ` · ${voidReasonLabel(s.voidReason)}` : ""}
            {s.voidNote ? ` · ${s.voidNote}` : ""}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Bill</Text>
        {s.hasBill ? (
          <Button label="View bill" variant="secondary" icon="eye-outline" onPress={() => setBillOpen(true)} />
        ) : (
          <StatusTag label="Bill missing" tone="notice" />
        )}
        <ImageCaptureField label={s.hasBill ? "Replace the bill" : "Attach the bill"} capture={capture} type="BILL" />
        {capture.key ? (
          <Button label="Save this bill" icon="checkmark" loading={attach.isPending} onPress={saveBill} />
        ) : null}
        {billError ? <Banner message={billError} /> : null}
      </Card>

      {!s.voided ? (
        <>
          <Button
            label="Edit wording"
            variant="secondary"
            icon="create-outline"
            onPress={() => navigation.navigate("SpendingEdit", { spendingId })}
          />
          <Button
            label="Void this spending"
            variant="danger"
            icon="close-circle-outline"
            onPress={() => navigation.navigate("SpendingVoid", { spendingId })}
          />
          <Text style={typography.bodySmall}>
            The amount, date and fund can&apos;t be edited — void the entry and add it again.
          </Text>
        </>
      ) : null}

      <BillSheet spendingId={spendingId} visible={billOpen} onClose={() => setBillOpen(false)} />
    </Screen>
  );
}

/** The bill image, from a short-lived signed URL fetched only while the sheet is open. */
function BillSheet({ spendingId, visible, onClose }: { spendingId: number; visible: boolean; onClose: () => void }) {
  const url = useBillUrl(spendingId, visible);
  return (
    <Sheet visible={visible} onClose={onClose} title="Bill">
      {url.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : url.error || !url.data ? (
        <Banner message={errorMessage(url.error, "Couldn't load the bill.")} />
      ) : (
        <Image source={{ uri: url.data.url }} style={styles.bill} resizeMode="contain" accessibilityLabel="Bill photo" />
      )}
      <Button label="Close" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  amount: { ...typography.display, fontSize: 30 },
  struck: { textDecorationLine: "line-through", color: colors.muted },
  link: { ...typography.bodySmall, color: colors.primary },
  facts: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  flex: { flex: 1 },
  voidNote: { ...typography.bodySmall, color: colors.error },
  bill: { width: "100%", height: 420 }
});
