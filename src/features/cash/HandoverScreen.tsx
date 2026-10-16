import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Card, ErrorState, LoadingScreen, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { formatDate, formatMoney } from "../../utils/format";
import { StatusTag } from "../money/components/StatusTag";
import { HandoverRow } from "./components/HandoverRow";
import { useHandover } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "Handover">;

/**
 * One handover and the receipts it covers — for an admin, or the collector who filed it. A receipt
 * cancelled since is listed, struck, and counts for nothing; a correction's replacement appears
 * here too, so the expected total always matches the receipts as they stand.
 */
export function HandoverScreen({ navigation, route }: Props) {
  const detail = useHandover(route.params.handoverId);
  if (detail.isPending) return <LoadingScreen />;
  if (detail.error || !detail.data) {
    return (
      <Screen>
        <ErrorState error={detail.error} title="Couldn't load the handover" onRetry={detail.refetch} />
      </Screen>
    );
  }
  const { handover, receipts } = detail.data;

  return (
    <Screen refreshing={detail.isRefetching} onRefresh={detail.refetch}>
      <HandoverRow handover={handover} showName />
      <Text style={typography.eyebrow}>Receipts</Text>
      {receipts.map((r) => (
        <Card key={r.id} onPress={() => navigation.navigate("Receipt", { contributionId: r.id })} accessibilityLabel={`Receipt ${r.receiptNo}`}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[typography.cardTitle, r.cancelled && styles.struck]}>{r.payerName}</Text>
              <Text style={typography.bodySmall}>
                {r.purposeLabel} · {formatDate(r.collectedAt)} · {r.receiptNo}
              </Text>
            </View>
            <Text style={[styles.mono, r.cancelled && styles.struck]}>{formatMoney(r.amount)}</Text>
          </View>
          {r.cancelled ? <StatusTag label="CANCELLED" tone="error" /> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 14 },
  struck: { textDecorationLine: "line-through", color: colors.muted }
});
