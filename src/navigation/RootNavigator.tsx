import { ActivityIndicator, View } from "react-native";
import { styles } from "../components/ui/styles";
import { useAuth } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";
import { UnlockScreen } from "../screens/auth/UnlockScreen";

export function RootNavigator() {
  const { session, initializing, locked, recordActivity } = useAuth();

  if (initializing) {
    return (
      <View style={[styles.safe, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color="#8E1B22" />
      </View>
    );
  }

  if (!session) return <AuthNavigator />;
  if (locked) return <UnlockScreen />;

  return (
    <View style={styles.safe} onTouchStart={recordActivity}>
      <MainTabs />
    </View>
  );
}
