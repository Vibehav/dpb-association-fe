import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NewPinScreen } from "../features/auth/NewPinScreen";
import { OtpScreen } from "../features/auth/OtpScreen";
import { PhoneScreen } from "../features/auth/PhoneScreen";
import { PinScreen } from "../features/auth/PinScreen";
import { colors } from "../theme";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Sign-in as four real screens rather than five steps inside one component's state.
 * Back navigation then works the way the design expects — "Change number" pops rather
 * than resetting a step flag.
 */
export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: "slide_from_right"
      }}
    >
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="Pin" component={PinScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="NewPin" component={NewPinScreen} />
    </Stack.Navigator>
  );
}
