import { Text, View } from "react-native";
import { styles } from "../../components/ui/styles";

export function CommitteePlaceholder() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Committee</Text>
      <Text style={styles.bodyText}>Committee management endpoints are split into the API layer, but screens are intentionally not implemented in this refactor.</Text>
    </View>
  );
}
