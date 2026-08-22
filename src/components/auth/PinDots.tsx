import { View } from "react-native";
import { styles } from "../ui/styles";

export function PinDots({ length }: { length: number }) {
  return (
    <View style={styles.pinDots}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={[styles.pinDot, index < length && styles.pinDotFilled]} />
      ))}
    </View>
  );
}
