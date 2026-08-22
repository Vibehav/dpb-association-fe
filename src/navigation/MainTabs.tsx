import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../features/home/HomeScreen";
import { PeopleListScreen } from "../features/people/PeopleListScreen";
import { ShopsListScreen } from "../features/shops/ShopsListScreen";
import { colors, typography } from "../theme";
import { AppHeader } from "./AppHeader";
import type { MainTabsParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabsParamList>();

/**
 * The v1 tab bar: **Shops · Home · People**.
 *
 * Integration doc §5 puts v1's bar at "Shops · People · Home", and the design wants Home
 * in the middle — with Events and Fund gone (both v2, no API), that means three tabs with
 * Home centred. Account opens from the initials in the header, not a tab.
 */
export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        header: () => <AppHeader title={route.name} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: typography.tabLabel,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border
        },
        tabBarIcon: ({ color, size }) => <Ionicons name={iconFor(route.name)} size={size} color={color} />
      })}
    >
      <Tab.Screen name="Shops" component={ShopsListScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="People" component={PeopleListScreen} />
    </Tab.Navigator>
  );
}

function iconFor(name: keyof MainTabsParamList): keyof typeof Ionicons.glyphMap {
  const icons: Record<keyof MainTabsParamList, keyof typeof Ionicons.glyphMap> = {
    Shops: "storefront-outline",
    Home: "home-outline",
    People: "people-outline"
  };
  return icons[name];
}
