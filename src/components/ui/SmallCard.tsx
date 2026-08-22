import { Text, View } from "react-native";
import { styles } from "./styles";

export function SmallCard({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <View style={styles.smallCard}>
      <Text style={styles.cardEyebrow}>{label}</Text>
      <Text style={[styles.smallValue, danger && styles.danger]}>{value}</Text>
      <Text style={styles.bodyText}>{sub}</Text>
    </View>
  );
}
