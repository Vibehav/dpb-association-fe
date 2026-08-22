import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { LoadingScreen } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { UnlockScreen } from "../features/auth/UnlockScreen";
import { AppStack } from "./AppStack";
import { AuthStack } from "./AuthStack";

/**
 * Chooses between signing in, unlocking, and the app itself.
 *
 * The unlock screen sits outside the NavigationContainer on purpose: it is a modal state
 * over an existing session, not a route, and nothing on it navigates.
 */
export function RootNavigator() {
  const { status, recordActivity } = useAuth();

  if (status === "loading") {
    return (
      <>
        <StatusBar style="dark" />
        <LoadingScreen />
      </>
    );
  }

  if (status === "locked") {
    return (
      <>
        <StatusBar style="dark" />
        <UnlockScreen />
      </>
    );
  }

  return (
    <View
      style={{ flex: 1 }}
      // Observe every touch to reset the inactivity timer without intercepting it.
      // `onTouchStart` on a non-responder view is unreliable; the capture hook is not.
      onStartShouldSetResponderCapture={() => {
        recordActivity();
        return false;
      }}
    >
      <StatusBar style="dark" />
      <NavigationContainer>{status === "signedOut" ? <AuthStack /> : <AppStack />}</NavigationContainer>
    </View>
  );
}
