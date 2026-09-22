import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccountScreen } from "../features/account/AccountScreen";
import { ChangePinScreen } from "../features/account/ChangePinScreen";
import { AddCommitteeMemberScreen } from "../features/committee/AddCommitteeMemberScreen";
import { CommitteeScreen } from "../features/committee/CommitteeScreen";
import { AddMemberScreen } from "../features/people/AddMemberScreen";
import { IdProofReplaceScreen } from "../features/people/IdProofReplaceScreen";
import { PersonEditScreen } from "../features/people/PersonEditScreen";
import { PersonProfileScreen } from "../features/people/PersonProfileScreen";
import { ShopAddPersonScreen } from "../features/shops/ShopAddPersonScreen";
import { ShopDetailScreen } from "../features/shops/ShopDetailScreen";
import { ShopFormScreen } from "../features/shops/ShopFormScreen";
import { ShopTransferScreen } from "../features/shops/ShopTransferScreen";
import { colors, fontFamilies } from "../theme";
import { MainTabs } from "./MainTabs";
import type { AppStackParamList } from "./types";

const Stack = createNativeStackNavigator<AppStackParamList>();

/**
 * The signed-in stack. Deeper screens push on top with a back arrow while the relevant
 * tab stays highlighted, per the design's navigation model (functional spec §5).
 */
export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.surface },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fontFamilies.serif, fontSize: 18 },
        headerShadowVisible: false
      }}
    >
      {/* MainTabs draws its own header so the title, name·role line and initials avatar
          match the prototype. */}
      <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Account" }} />

      <Stack.Screen name="ShopDetail" component={ShopDetailScreen} options={{ title: "Shop" }} />
      {/* Multi-field flows are presented as modals — the design's bottom sheets, without
          pulling in a gesture library (see the plan's decision 0.6). */}
      <Stack.Screen name="ShopForm" component={ShopFormScreen} options={{ presentation: "modal" }} />
      <Stack.Screen
        name="ShopAddPerson"
        component={ShopAddPersonScreen}
        options={{ presentation: "modal", title: "Add person" }}
      />
      <Stack.Screen
        name="ShopTransfer"
        component={ShopTransferScreen}
        options={{ presentation: "modal", title: "Transfer licence" }}
      />

      <Stack.Screen name="PersonProfile" component={PersonProfileScreen} options={{ title: "Member" }} />
      <Stack.Screen
        name="PersonEdit"
        component={PersonEditScreen}
        options={{ presentation: "modal", title: "Edit member" }}
      />
      <Stack.Screen
        name="IdProofReplace"
        component={IdProofReplaceScreen}
        options={{ presentation: "modal", title: "Replace ID proof" }}
      />
      <Stack.Screen
        name="AddMember"
        component={AddMemberScreen}
        options={{ presentation: "modal", title: "Add a member" }}
      />

      <Stack.Screen
        name="ChangePin"
        component={ChangePinScreen}
        options={{ presentation: "modal", title: "Change M-PIN" }}
      />
      <Stack.Screen name="Committee" component={CommitteeScreen} options={{ title: "Committee" }} />
      <Stack.Screen
        name="AddCommitteeMember"
        component={AddCommitteeMemberScreen}
        options={{ presentation: "modal", title: "Add committee member" }}
      />
    </Stack.Navigator>
  );
}
