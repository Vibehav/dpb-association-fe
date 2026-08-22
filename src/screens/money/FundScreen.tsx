import { Text, View } from "react-native";
import { SmallCard } from "../../components/ui/SmallCard";
import { styles } from "../../components/ui/styles";
import { Dashboard } from "../../types";
import { money } from "../../utils/format";

export function FundScreen({ dashboard }: { dashboard: Dashboard }) {
  return (
    <View style={styles.stack}>
      <View style={styles.balanceCard}>
        <Text style={styles.cardEyebrow}>General fund balance</Text>
        <Text style={styles.balanceText}>{money(dashboard.generalFundBalance)}</Text>
      </View>
      <View style={styles.row}>
        <SmallCard label="Collected" value={money(dashboard.generalCollected)} sub="All valid receipts" />
        <SmallCard label="Spent" value={money(dashboard.generalSpent)} sub="Treasurer entries" danger />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Treasurer controls</Text>
        <Text style={styles.bodyText}>Spending, corrections, annual fee cycle and statements belong here once the backend endpoints are connected.</Text>
      </View>
    </View>
  );
}
