import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActiveEventCard, Dashboard, FeeStatus } from "../../api";
import { usePermissions } from "../../auth/usePermissions";
import { Button, Card, ErrorState, Screen } from "../../components/ui";
import type { AppStackParamList, MainTabsParamList, ShopFeeFilter } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { eventDates, formatMoney, shopTitle } from "../../utils/format";
import { useDashboard } from "../money/hooks";
import { useShopsList } from "../shops/hooks";
import { usePeopleCount, useShopCount } from "./useCounts";

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

/** How many shops each fee list shows before "View all" hands off to the Shops tab. */
const PREVIEW = 3;

/**
 * Home (spec §6.1).
 *
 * Every money figure comes from `GET /dashboard`, which the server shapes by role: for a
 * collector or viewer `spent` and `balance` arrive **null** and `showOutgoing` false — the
 * figures are withheld, not hidden here — so this screen branches on `showOutgoing` and never
 * renders a null as ₹0.
 *
 * The fee is three separate things, as agreed with the client: shops with nothing paid yet,
 * shops part paid, and arrears from closed years. Each list comes from the shops endpoint's
 * own `feeStatus` / `arrears` filter, server-side.
 *
 * Events (v2 Phase 2): the "Event funds · kept separate" tile and one card per event active
 * today, shaped by role on the server the same way — collected only for a collector or viewer.
 */
export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { canWrite, isAdmin } = usePermissions();
  const dashboard = useDashboard();
  const shops = useShopCount();
  const people = usePeopleCount();

  async function refetchAll() {
    await Promise.all([dashboard.refetch(), shops.refetch(), people.refetch()]);
  }

  const error = dashboard.error ?? shops.error ?? people.error;
  const refreshing = dashboard.isFetching || shops.isFetching || people.isFetching;
  const d = dashboard.data;

  return (
    <Screen refreshing={refreshing} onRefresh={refetchAll}>
      {error ? (
        <ErrorState error={error} title="Couldn't load Home" onRetry={refetchAll} />
      ) : (
        <>
          {d ? <FundCard dashboard={d} onOpen={isAdmin ? () => navigation.navigate("Fund") : undefined} /> : null}
          {d && d.eventFunds.eventCount > 0 ? (
            <EventFundsCard dashboard={d} onOpen={() => navigation.navigate("Events")} />
          ) : null}

          {canWrite ? (
            <Button label="Record a contribution" icon="cash-outline" onPress={() => navigation.navigate("Collect")} />
          ) : null}

          <View style={styles.row}>
            <CountCard
              label="Shops on record"
              value={shops.data}
              icon="storefront-outline"
              onPress={() => navigation.navigate("Shops")}
            />
            <CountCard
              label="People on record"
              value={people.data}
              icon="people-outline"
              onPress={() => navigation.navigate("People")}
            />
          </View>

          {d?.activeEvents.map((event) => (
            <ActiveEvent key={event.id} event={event} onOpen={() => navigation.navigate("Event", { eventId: event.id })} />
          ))}

          {d ? <FeeCard dashboard={d} isAdmin={isAdmin} canWrite={canWrite} navigation={navigation} /> : null}

          {d && d.topContributors.length > 0 ? (
            <Card>
              <Text style={typography.eyebrow}>Top contributors this year</Text>
              {d.topContributors.map((top) => (
                <Pressable
                  key={`${top.payerType}${top.payerId}`}
                  style={styles.listRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${top.name}`}
                  onPress={() =>
                    top.payerType === "MEMBER"
                      ? navigation.navigate("PersonProfile", { personId: top.payerId })
                      : navigation.navigate("DonorProfile", { donorId: top.payerId })
                  }
                >
                  <Text style={[typography.cardTitle, styles.flex]}>{top.name}</Text>
                  <Text style={styles.mono}>{formatMoney(top.total)}</Text>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** The general fund, shaped by role on the server. */
function FundCard({ dashboard, onOpen }: { dashboard: Dashboard; onOpen?: () => void }) {
  if (!dashboard.showOutgoing) {
    return (
      <Card>
        <Text style={typography.eyebrow}>Collected into the general fund</Text>
        <Text style={styles.big}>{formatMoney(dashboard.collected)}</Text>
        <Text style={typography.bodySmall}>Spendings are visible to the treasurer only.</Text>
      </Card>
    );
  }
  // The balance also counts the opening balance and money moved in from events — say so, or
  // collected − spent visibly fails to add up to it.
  const extras = [
    dashboard.openingBalance ? `opening balance ${formatMoney(dashboard.openingBalance)}` : null,
    dashboard.movedIn ? `${formatMoney(dashboard.movedIn)} from events` : null
  ].filter(Boolean);
  return (
    <Card onPress={onOpen} accessibilityLabel="Open the general fund">
      <Text style={typography.eyebrow}>General fund balance</Text>
      <Text style={styles.big}>{formatMoney(dashboard.balance)}</Text>
      <View style={styles.row}>
        <Text style={[typography.body, styles.flex]}>Collected {formatMoney(dashboard.collected)}</Text>
        <Text style={[typography.body, styles.flex]}>Spent {formatMoney(dashboard.spent)}</Text>
      </View>
      {extras.length > 0 ? <Text style={typography.bodySmall}>Includes {extras.join(" and ")}.</Text> : null}
    </Card>
  );
}

/**
 * "Event funds · kept separate". An admin sees what every own-fund event still holds; anyone
 * else sees what has been collected for events not yet closed (their `balance` is withheld).
 */
function EventFundsCard({ dashboard, onOpen }: { dashboard: Dashboard; onOpen: () => void }) {
  const funds = dashboard.eventFunds;
  const admin = dashboard.showOutgoing;
  const noun = funds.eventCount === 1 ? "event" : "events";
  return (
    <Card onPress={onOpen} accessibilityLabel="Open events">
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={typography.eyebrow}>Event funds · kept separate</Text>
          <Text style={typography.bodySmall}>
            {funds.eventCount} {noun} with their own fund{admin ? "" : " · collected"}
          </Text>
        </View>
        <Text style={styles.mono}>{formatMoney(admin ? funds.balance : funds.collected)}</Text>
      </View>
    </Card>
  );
}

/**
 * One event active today. Own fund, admin: collected / spent / remaining and the three-part
 * bar — own-fund spend, general-fund support, unspent. General-funded (admins only ever get
 * one): what the general fund spent. Anyone else: collected only.
 */
function ActiveEvent({ event: e, onOpen }: { event: ActiveEventCard; onOpen: () => void }) {
  const admin = e.spentFromGeneral !== null;
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={typography.eyebrow}>Active event</Text>
          <Text style={typography.cardTitle}>{e.name}</Text>
          <Text style={typography.bodySmall}>{eventDates(e.startsOn, e.endsOn)}</Text>
        </View>
        <Button label="Open" variant="secondary" onPress={onOpen} />
      </View>

      {!e.ownFund ? (
        <>
          <Text style={typography.eyebrow}>Spent from general fund</Text>
          <Text style={styles.mono}>{formatMoney(e.spentFromGeneral)}</Text>
          <Text style={typography.bodySmall}>Paid from the general fund · no separate collection for this event</Text>
        </>
      ) : admin ? (
        <>
          <View style={styles.row}>
            <Figure label="Collected" value={e.collected} />
            <Figure label="Spent" value={(e.spentFromEventFund ?? 0) + (e.spentFromGeneral ?? 0)} />
            <Figure label="Remaining" value={e.balance} />
          </View>
          <SpendBar event={e} />
          <Text style={typography.bodySmall}>
            {e.spentFromGeneral && e.spentFromGeneral > 0
              ? `${formatMoney(e.spentFromGeneral)} of it came from the general fund`
              : "All of it paid from this event's own collection"}
          </Text>
        </>
      ) : (
        <Figure label="Collected" value={e.collected} />
      )}
    </Card>
  );
}

/** Own-fund spend · general-fund support · unspent, as shares of what was collected. */
function SpendBar({ event: e }: { event: ActiveEventCard }) {
  const collected = e.collected ?? 0;
  if (collected <= 0) return null;
  const share = (value: number | null) => `${Math.max(0, Math.min(100, ((value ?? 0) / collected) * 100))}%` as const;
  return (
    <View style={styles.bar} accessibilityLabel="How the collection was spent">
      <View style={[styles.barPart, { width: share(e.spentFromEventFund), backgroundColor: colors.primary }]} />
      <View style={[styles.barPart, { width: share(e.spentFromGeneral), backgroundColor: colors.warning }]} />
    </View>
  );
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.flex}>
      <Text style={typography.eyebrow}>{label}</Text>
      <Text style={styles.mono}>{formatMoney(value)}</Text>
    </View>
  );
}

function FeeCard({
  dashboard,
  isAdmin,
  canWrite,
  navigation
}: {
  dashboard: Dashboard;
  isAdmin: boolean;
  canWrite: boolean;
  navigation: HomeNavigation;
}) {
  const fee = dashboard.fee;
  const openShops = (feeFilter: ShopFeeFilter) => navigation.navigate("Shops", { feeFilter });

  return (
    <>
      <Card>
        <Text style={typography.eyebrow}>Annual fee {fee.yearLabel ?? ""}</Text>
        {fee.yearLabel === null ? (
          <Text style={typography.body}>No fee year is open.</Text>
        ) : !fee.demandRaised ? (
          <Text style={typography.body}>No demand raised for {fee.yearLabel} yet.</Text>
        ) : (
          <>
            <FeeLine label="Nothing paid yet" count={fee.pendingCount} amount={fee.pendingAmount} onPress={() => openShops("PENDING")} />
            <FeeLine label="Part paid · still due" count={fee.partialCount} amount={fee.partialDue} onPress={() => openShops("PARTIAL")} />
          </>
        )}
        {fee.arrearsShopCount > 0 ? (
          <FeeLine label="Arrears from earlier years" count={fee.arrearsShopCount} amount={fee.arrearsAmount} onPress={() => openShops("ARREARS")} />
        ) : null}
        {isAdmin && (fee.yearLabel === null || !fee.demandRaised) ? (
          <Button label="Open the annual fee" variant="secondary" icon="calendar-outline" onPress={() => navigation.navigate("FeeCycle")} />
        ) : null}
      </Card>

      {fee.demandRaised && fee.pendingCount > 0 ? (
        <PendingList title="Pending collections" feeStatus="PENDING" canWrite={canWrite} navigation={navigation} onViewAll={() => openShops("PENDING")} />
      ) : null}
      {fee.demandRaised && fee.partialCount > 0 ? (
        <PendingList title="Part payments" feeStatus="PARTIAL" canWrite={canWrite} navigation={navigation} onViewAll={() => openShops("PARTIAL")} />
      ) : null}
    </>
  );
}

function FeeLine({ label, count, amount, onPress }: { label: string; count: number; amount: number; onPress: () => void }) {
  return (
    <Pressable style={styles.listRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.flex}>
        <Text style={typography.body}>{label}</Text>
        <Text style={typography.bodySmall}>
          {count} {count === 1 ? "shop" : "shops"}
        </Text>
      </View>
      <Text style={styles.mono}>{formatMoney(amount)}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

/**
 * The first few shops in one fee position. Each row taps straight into a pre-filled
 * collection (spec §6.1) — or into the shop, for a viewer, who cannot collect.
 */
function PendingList({
  title,
  feeStatus,
  canWrite,
  navigation,
  onViewAll
}: {
  title: string;
  feeStatus: Extract<FeeStatus, "PENDING" | "PARTIAL">;
  canWrite: boolean;
  navigation: HomeNavigation;
  onViewAll: () => void;
}) {
  const list = useShopsList({ feeStatus });
  const shops = (list.data?.pages[0]?.content ?? []).slice(0, PREVIEW);

  return (
    <Card>
      <Text style={typography.eyebrow}>{title}</Text>
      {shops.map((shop) => (
        <Pressable
          key={shop.id}
          style={styles.listRow}
          accessibilityRole="button"
          accessibilityLabel={`${canWrite ? "Collect from" : "Open"} ${shop.shopNumber}`}
          onPress={() =>
            canWrite && shop.licenceHolderName
              ? navigation.navigate("Collect", { shopId: shop.id, purpose: "ANNUAL_FEE" })
              : navigation.navigate("ShopDetail", { shopId: shop.id })
          }
        >
          <View style={styles.flex}>
            <Text style={typography.cardTitle}>
              {shop.shopNumber} · {shopTitle(shop)}
            </Text>
            <Text style={typography.bodySmall}>{shop.licenceHolderName ?? "Licence holder not added yet"}</Text>
          </View>
          <Text style={styles.mono}>{formatMoney(shop.feeDue)}</Text>
        </Pressable>
      ))}
      <Button label="View all" variant="ghost" onPress={onViewAll} />
    </Card>
  );
}

function CountCard({
  label,
  value,
  icon,
  onPress
}: {
  label: string;
  value: number | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Card style={styles.countCard} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.countValue}>{value === undefined ? "—" : value.toLocaleString("en-IN")}</Text>
      <Text style={typography.eyebrow}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
  big: { ...typography.display, fontSize: 32 },
  mono: { ...typography.mono, fontSize: 13 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  countCard: { flex: 1, gap: spacing.sm },
  bar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.soft,
    marginVertical: spacing.sm
  },
  barPart: { height: "100%" },
  countValue: { ...typography.display, fontSize: 30 }
});
