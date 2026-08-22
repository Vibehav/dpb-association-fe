import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { styles } from "../ui/styles";

export function Keypad({ value, setValue }: { value: string; setValue: (value: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
  return (
    <View style={styles.keypad}>
      {keys.map((key, index) => (
        <Pressable
          key={`${key}-${index}`}
          style={[styles.key, !key && styles.keyBlank]}
          disabled={!key}
          onPress={() => {
            if (key === "back") setValue(value.slice(0, -1));
            else if (value.length < 4) setValue(value + key);
          }}
        >
          {key === "back" ? <Ionicons name="backspace-outline" size={24} color="#5A5148" /> : <Text style={styles.keyText}>{key}</Text>}
        </Pressable>
      ))}
    </View>
  );
}
