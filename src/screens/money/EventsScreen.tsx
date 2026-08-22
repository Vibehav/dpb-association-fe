import { Text, View } from "react-native";
import { Metric } from "../../components/ui/Metric";
import { styles } from "../../components/ui/styles";
import { EventSummary } from "../../types";
import { money } from "../../utils/format";

export function EventsScreen({ events }: { events: EventSummary[] }) {
  return (
    <View style={styles.stack}>
      {events.map((event) => (
        <View key={event.id} style={styles.card}>
          <View style={styles.cardHeaderLine}>
            <View>
              <Text style={styles.cardTitle}>{event.name}</Text>
              <Text style={styles.bodyText}>{event.ownFund ? "Own event fund" : "Paid from general fund"}</Text>
            </View>
            <Text style={styles.status}>{event.status}</Text>
          </View>
          <View style={styles.splitRow}>
            <Metric label="Collected" value={money(event.collected)} />
            <Metric label="Spent" value={money(event.spent)} />
            <Metric label="Remaining" value={money(event.remaining)} />
          </View>
        </View>
      ))}
    </View>
  );
}
