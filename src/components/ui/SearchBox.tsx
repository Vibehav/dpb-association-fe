import { Ionicons } from "@expo/vector-icons";
import { TextInput, View } from "react-native";
import { styles } from "./styles";

export function SearchBox({
  value,
  onChangeText,
  placeholder
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Ionicons name="search" size={18} color="#8A8177" />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} style={styles.searchInput} />
    </View>
  );
}
