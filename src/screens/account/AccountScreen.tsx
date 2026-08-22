import { Text, View } from "react-native";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { styles } from "../../components/ui/styles";
import { useAuth } from "../../context/AuthContext";

export function AccountScreen() {
  const { lock, session, signOut } = useAuth();

  if (!session) return null;

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{session.user.name}</Text>
        <Text style={styles.bodyText}>+91 {session.user.phone}</Text>
        <Text style={styles.bodyText}>{session.user.role}</Text>
      </View>
      <PrimaryButton label="Lock app" icon="lock-closed" onPress={lock} />
      <PrimaryButton label="Sign out" onPress={signOut} />
    </View>
  );
}
