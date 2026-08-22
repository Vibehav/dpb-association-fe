import { Text, View } from "react-native";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SearchBox } from "../../components/ui/SearchBox";
import { styles } from "../../components/ui/styles";
import { Person } from "../../types";
import { money } from "../../utils/format";

export function PeopleScreen({
  people,
  search,
  setSearch,
  canWrite
}: {
  people: Person[];
  search: string;
  setSearch: (value: string) => void;
  canWrite: boolean;
}) {
  return (
    <View style={styles.stack}>
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search name, phone or shop" />
      <Text style={styles.countLine}>{people.length} people shown</Text>
      {people.map((person) => (
        <View key={person.id} style={styles.card}>
          <View style={styles.cardHeaderLine}>
            <View style={styles.personTitle}>
              <Text style={styles.cardTitle}>{person.name}</Text>
              <Text style={styles.bodyText}>{person.phone}</Text>
            </View>
            <Text style={styles.mono}>{money(person.lifetimeGiven)}</Text>
          </View>
          <Text style={styles.bodyText}>{person.roles.join(", ")} · {person.shops.join(", ")}</Text>
          <Text style={styles.bodyText}>Last: {person.lastContribution || "No contribution yet"}</Text>
        </View>
      ))}
      {canWrite ? <PrimaryButton label="Add a member" icon="person-add" onPress={() => {}} /> : null}
    </View>
  );
}
