import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../../theme";

/** Full-screen spinner — session restore and font loading. */
export function LoadingScreen() {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  }
});
