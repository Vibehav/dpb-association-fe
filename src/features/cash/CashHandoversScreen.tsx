import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CollectorCash, Handover } from "../../api";
import { Card, ErrorState, LoadingScreen, Screen } from "../../components/ui";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { formatMoney } from "../../utils/format";
import { StatusTag } from "../money/components/StatusTag";
import { HandoverRow } from "./components/HandoverRow";
import { ReceiveSheet } from "./components/ReceiveSheet";
import { useCollectorsCash, useHandovers } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "CashHandovers">;

/**
 * Cash handovers (spec §6.15) — admin only. What each collector should still bring, the
 * handovers waiting to be counted, and the history. Every figure is the server's.
 */
export function CashHandoversScreen({ navigation }: Props) {
  const collectors = useCollectorsCash();
  const pending = useHandovers("PENDING");
  const history = useHandovers("RECEIVED");
  const [counting, setCounting] = useState<Handover | null>(null);

  async function refresh() {
    await Promise.all([collectors.refetch(), pending.refetch(), history.refetch()]);
  }
  useRefreshOnFocus(refresh);

  if (collectors.isPending) return <LoadingScreen />;
  if (collectors.error || !collectors.data) {
    return (
      <Screen>
        <ErrorState error={collectors.error} title="Couldn't load cash handovers" onRetry={refresh} />
      </Screen>
    );
  }
  const c = collectors.data;
  const waiting = pending.data?.content ?? [];
  const earlier = history.data?.content ?? [];

  return (
    <Screen refreshing={collectors.isRefetching} onRefresh={refresh}>
      <Card>
        <Text style={typography.eyebrow}>Cash with collectors</Text>
        <Text style={styles.big}>{formatMoney(c.totalWithCollectors)}</Text>
        <Text style={typography.bodySmall}>Collected in cash and not yet handed over, or still to be settled.</Text>
      </Card>

      <Text style={typography.eyebrow}>Waiting for you</Text>
      {waiting.length === 0 ? (
        <Text style={typography.bodySmall}>Nothing waiting — every handover has been counted.</Text>
      ) : (
        waiting.map((h) => <HandoverRow key={h.id} handover={h} showName onPress={() => setCounting(h)} />)
      )}

      <Text style={typography.eyebrow}>Expected from each collector</Text>
      {c.collectors.map((row) => (
        <CollectorRow key={row.id} row={row} onPress={() => navigation.navigate("CollectorCash", { collectorId: row.id })} />
      ))}

      {earlier.length > 0 ? <Text style={typography.eyebrow}>Earlier handovers</Text> : null}
      {earlier.map((h) => (
        <HandoverRow key={h.id} handover={h} showName onPress={() => navigation.navigate("Handover", { handoverId: h.id })} />
      ))}

      <ReceiveSheet handover={counting} onClose={() => setCounting(null)} />
    </Screen>
  );
}

function CollectorRow({ row: r, onPress }: { row: CollectorCash; onPress: () => void }) {
  const line =
    r.total === 0
      ? "Nothing pending"
      : [
          r.cashWithYou > 0 ? `${formatMoney(r.cashWithYou)} in hand` : null,
          r.inTransit > 0 ? `${formatMoney(r.inTransit)} handed over, waiting` : null
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <Card onPress={onPress} accessibilityLabel={`Open ${r.name}`}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={typography.cardTitle}>{r.name}</Text>
          {line ? <Text style={typography.bodySmall}>{line}</Text> : null}
          {!r.activeCollector ? <Text style={typography.bodySmall}>No longer a collector</Text> : null}
        </View>
        <Text style={styles.mono}>{formatMoney(r.total)}</Text>
      </View>
      {r.outstanding > 0 ? <StatusTag label={`${formatMoney(r.outstanding)} short`} tone="error" /> : null}
      {r.outstanding < 0 ? <StatusTag label={`${formatMoney(-r.outstanding)} extra with the treasurer`} tone="notice" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { ...typography.display, fontSize: 32 },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  mono: { ...typography.mono, fontSize: 14 }
});
