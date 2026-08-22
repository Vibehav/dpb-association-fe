import { Pressable, Text, View } from "react-native";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SearchBox } from "../../components/ui/SearchBox";
import { styles } from "../../components/ui/styles";
import { Shop } from "../../types";
import { money } from "../../utils/format";

export function ShopsScreen({
  shops,
  search,
  setSearch,
  canWrite
}: {
  shops: Shop[];
  search: string;
  setSearch: (value: string) => void;
  canWrite: boolean;
}) {
  return (
    <View style={styles.stack}>
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search shop, business or person" />
      <Text style={styles.countLine}>{shops.length} shops shown</Text>
      {shops.map((shop) => (
        <Pressable key={shop.id} style={styles.card}>
          <View style={styles.cardHeaderLine}>
            <View>
              <Text style={styles.cardTitle}>{shop.number}</Text>
              <Text style={styles.bodyText}>{shop.businessName}</Text>
            </View>
            <FeeChip status={shop.feeStatus} due={shop.feeDue} />
          </View>
          <Text style={styles.bodyText}>{shop.wing} · {shop.floor}</Text>
          <Text style={styles.bodyText}>Licence holder: {shop.ownerName || "Not added yet"}</Text>
          {!!shop.rentedTo && <Text style={styles.bodyText}>Rented to {shop.rentedTo}</Text>}
          <Text style={styles.bodyText}>{shop.workersCount} workers on record</Text>
        </Pressable>
      ))}
      {canWrite ? <PrimaryButton label="Register new shop" icon="add" onPress={() => {}} /> : null}
    </View>
  );
}

function FeeChip({ status, due }: { status: Shop["feeStatus"]; due?: number }) {
  if (status === "none") return null;
  const paid = status === "paid";
  return (
    <View style={[styles.chip, paid ? styles.chipPaid : styles.chipDue]}>
      <Text style={[styles.chipText, paid ? styles.chipTextPaid : styles.chipTextDue]}>
        {paid ? "Fee paid" : `Due ${money(due || 0)}`}
      </Text>
    </View>
  );
}
