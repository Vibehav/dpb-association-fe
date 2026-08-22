import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Keypad } from "../../components/auth/Keypad";
import { PinDots } from "../../components/auth/PinDots";
import { styles } from "../../components/ui/styles";
import { useAuth } from "../../context/AuthContext";

export function UnlockScreen() {
  const { session, signOut, unlock } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function verifyPin() {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    setError("");
    try {
      await unlock(pin);
    } catch (caught) {
      setPin("");
      setError(caught instanceof Error ? caught.message : "Wrong M-PIN.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pin.length === 4) verifyPin();
  }, [pin]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.authScreen}>
        <Image source={require("../../../uploads/logo-1784996881407.jpeg")} style={styles.logo} />
        <Text style={styles.authTitle}>Welcome Back</Text>
        <Text style={styles.eyebrow}>{session?.user.name || "Committee member"}</Text>

        <View style={styles.authPanel}>
          <Text style={styles.authHint}>{loading ? "Checking M-PIN..." : "Enter your 4-digit M-PIN"}</Text>
          <PinDots length={pin.length} />
          <Keypad value={pin} setValue={setPin} />
          <Pressable style={styles.authLinkCenter} onPress={signOut}>
            <Text style={styles.linkAction}>Sign in with another number</Text>
          </Pressable>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}
