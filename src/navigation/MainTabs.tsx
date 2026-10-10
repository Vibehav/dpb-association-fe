import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { usePermissions } from "../auth/usePermissions";
import { HomeScreen } from "../features/home/HomeScreen";
import { EventsListScreen } from "../features/events/EventsListScreen";
import { FundScreen } from "../features/money/FundScreen";
import { PeopleListScreen } from "../features/people/PeopleListScreen";
import { ShopsListScreen } from "../features/shops/ShopsListScreen";
import { colors, typography } from "../theme";
import { AppHeader } from "./AppHeader";
import type { MainTabsParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabsParamList>();

/**
 * The tab bar, in the prototype's order (`TABS_ADMIN` / `TABS_STAFF`): **Shops · People ·
 * Home · Fund · Events** for an admin — Home in the centre of the five — and **Shops · People
 * · Home · Events** for everyone else. Account opens from the initials in the header, not a
 * tab.
 *
 * Fund is not registered at all for a collector or viewer — the endpoint refuses them
 * anyway, and a tab that only ever shows a refusal is worse than no tab. Because the role is
 * re-derived from `/me`, a demotion removes it on the next render.
 */
export function MainTabs() {
  const { isAdmin } = usePermissions();
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
      <Tab.Screen name="People" component={PeopleListScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      {isAdmin ? <Tab.Screen name="Fund" component={FundScreen} /> : null}
      <Tab.Screen name="Events" component={EventsListScreen} />
    </Tab.Navigator>
  );
}

function iconFor(name: keyof MainTabsParamList): keyof typeof Ionicons.glyphMap {
  const icons: Record<keyof MainTabsParamList, keyof typeof Ionicons.glyphMap> = {
    Shops: "storefront-outline",
    People: "people-outline",
    Home: "home-outline",
    Fund: "wallet-outline",
    Events: "sparkles-outline"
  };
  return icons[name];
}
