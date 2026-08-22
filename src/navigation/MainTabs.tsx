import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, peopleApi, shopsApi } from "../api";
import { styles } from "../components/ui/styles";
import { useAuth } from "../context/AuthContext";
import { AccountScreen } from "../screens/account/AccountScreen";
import { HomeScreen } from "../screens/home/HomeScreen";
import { EventsScreen } from "../screens/money/EventsScreen";
import { FundScreen } from "../screens/money/FundScreen";
import { PeopleScreen } from "../screens/people/PeopleScreen";
import { ShopsScreen } from "../screens/shops/ShopsScreen";
import { Dashboard, EventSummary, Person, Role, Shop } from "../types";
import { initials } from "../utils/format";
import { dashboardMock, eventsMock, peopleMock, shopsMock } from "../mockData";

type Tab = "shops" | "people" | "home" | "fund" | "events";
type MainPage = "tabs" | "account";

const roleTitle: Record<Role, string> = {
  admin: "Admin",
  collector: "Collector",
  viewer: "Viewer"
};

export function MainTabs() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [page, setPage] = useState<MainPage>("tabs");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [apiNotice, setApiNotice] = useState("");

  const isAdmin = session?.user.role === "admin";
  const canWrite = session?.user.role === "admin" || session?.user.role === "collector";
  const tabs = useMemo<Tab[]>(
    () => (isAdmin ? ["shops", "people", "home", "fund", "events"] : ["shops", "people", "home", "events"]),
    [isAdmin]
  );

  async function loadData() {
    if (!session) return;
    setLoadingData(true);
    setApiNotice("");
    try {
      const [s, p] = await Promise.all([
        shopsApi.list(session.token, search),
        peopleApi.list(session.token, search)
      ]);
      setDashboard(dashboardMock);
      setShops(s);
      setPeople(p);
      setEvents(eventsMock);
      setApiNotice("Connected to backend for register data. Dashboard, fund and events are using demo data until those API modules are added.");
    } catch {
      setDashboard(dashboardMock);
      setShops(filterShops(shopsMock, search));
      setPeople(filterPeople(peopleMock, search));
      setEvents(eventsMock);
      setApiNotice(`Using demo data. Backend not reachable at ${API_BASE_URL}.`);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [session, search]);

  if (!session) return null;

  const title = page === "account" ? "Account" : titleFor(activeTab);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>
            {session.user.name} · {roleTitle[session.user.role]}
          </Text>
        </View>
        <Pressable style={styles.avatar} onPress={() => setPage(page === "account" ? "tabs" : "account")}>
          <Text style={styles.avatarText}>{initials(session.user.name)}</Text>
        </Pressable>
      </View>

      {apiNotice ? <Text style={styles.notice}>{apiNotice}</Text> : null}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={<RefreshControl refreshing={loadingData} onRefresh={loadData} />}
      >
        {loadingData && !dashboard ? <ActivityIndicator color="#8E1B22" /> : null}
        {page === "account" ? <AccountScreen /> : null}
        {page === "tabs" && activeTab === "home" && dashboard ? <HomeScreen dashboard={dashboard} isAdmin={isAdmin} /> : null}
        {page === "tabs" && activeTab === "shops" ? (
          <ShopsScreen shops={shops} search={search} setSearch={setSearch} canWrite={canWrite} />
        ) : null}
        {page === "tabs" && activeTab === "people" ? (
          <PeopleScreen people={people} search={search} setSearch={setSearch} canWrite={canWrite} />
        ) : null}
        {page === "tabs" && activeTab === "fund" && dashboard ? <FundScreen dashboard={dashboard} /> : null}
        {page === "tabs" && activeTab === "events" ? <EventsScreen events={events} /> : null}
      </ScrollView>

      {page === "tabs" ? (
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable key={tab} style={styles.tabButton} onPress={() => setActiveTab(tab)}>
              <Ionicons name={iconFor(tab)} size={22} color={activeTab === tab ? "#8E1B22" : "#8A8177"} />
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{titleFor(tab)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function filterShops(shops: Shop[], search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return shops;
  return shops.filter((shop) =>
    [shop.number, shop.businessName, shop.ownerName, shop.rentedTo, shop.wing].filter(Boolean).join(" ").toLowerCase().includes(q)
  );
}

function filterPeople(people: Person[], search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return people;
  return people.filter((person) =>
    [person.name, person.phone, person.shops.join(" "), person.roles.join(" ")].join(" ").toLowerCase().includes(q)
  );
}

function titleFor(tab: Tab) {
  return {
    shops: "Shops",
    people: "People",
    home: "Home",
    fund: "Fund",
    events: "Events"
  }[tab];
}

function iconFor(tab: Tab): keyof typeof Ionicons.glyphMap {
  const icons: Record<Tab, keyof typeof Ionicons.glyphMap> = {
    shops: "storefront-outline",
    people: "people-outline",
    home: "home-outline",
    fund: "wallet-outline",
    events: "calendar-outline"
  };
  return icons[tab];
}
