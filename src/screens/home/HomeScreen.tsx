import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Metric } from "../../components/ui/Metric";
import { SmallCard } from "../../components/ui/SmallCard";
import { styles } from "../../components/ui/styles";
import { Dashboard } from "../../types";
import { money } from "../../utils/format";

export function HomeScreen({ dashboard, isAdmin }: { dashboard: Dashboard; isAdmin: boolean }) {
  return (
    <View style={styles.stack}>
      <View style={styles.balanceCard}>
        <Text style={styles.cardEyebrow}>{isAdmin ? "General fund balance" : "Collected into general fund"}</Text>
        <Text style={styles.balanceText}>{money(isAdmin ? dashboard.generalFundBalance : dashboard.generalCollected)}</Text>
        {isAdmin ? (
          <View style={styles.splitRow}>
            <Metric label="Collected" value={money(dashboard.generalCollected)} light />
            <Metric label="Spent" value={money(dashboard.generalSpent)} light />
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <SmallCard label="Shops on record" value={String(dashboard.shopsOnRecord)} sub={`${dashboard.peopleOnRecord} people linked`} />
        <SmallCard label="Fees pending" value={String(dashboard.pendingShopCount)} sub={money(dashboard.pendingAmount)} danger />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Event funds · kept separate</Text>
        <View style={styles.cardHeaderLine}>
          <Text style={styles.cardTitle}>{money(dashboard.eventFundBalance)}</Text>
          <Ionicons name="chevron-forward" size={20} color="#8A8177" />
        </View>
        <Text style={styles.bodyText}>{dashboard.eventFundLine}</Text>
      </View>

      {dashboard.activeEvent ? (
        <View style={styles.card}>
          <Text style={[styles.cardEyebrow, styles.orange]}>Active event</Text>
          <Text style={styles.cardTitle}>{dashboard.activeEvent.name}</Text>
          <View style={styles.splitRow}>
            <Metric label="Collected" value={money(dashboard.activeEvent.collected)} />
            <Metric label={isAdmin ? "Spent" : "Remaining"} value={money(isAdmin ? dashboard.activeEvent.spent : dashboard.activeEvent.remaining)} />
          </View>
          {isAdmin ? <Text style={styles.bodyText}>{money(dashboard.activeEvent.generalSupport)} supported from general fund.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
