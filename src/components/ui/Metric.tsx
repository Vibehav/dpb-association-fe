import { Text, View } from "react-native";
import { styles } from "./styles";

export function Metric({ label, value, light }: { label: string; value: string; light?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, light && styles.metricLabelLight]}>{label}</Text>
      <Text style={[styles.metricValue, light && styles.metricValueLight]}>{value}</Text>
    </View>
  );
}
