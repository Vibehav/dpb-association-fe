import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi } from "../../api";
import { Keypad } from "../../components/auth/Keypad";
import { PinDots } from "../../components/auth/PinDots";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { styles } from "../../components/ui/styles";
import { useAuth } from "../../context/AuthContext";

export function LoginScreen() {
  const { signIn, setPinAndSignIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<"FIRST_LOGIN" | "PIN_RESET">("PIN_RESET");
  const [authStep, setAuthStep] = useState<"phone" | "pin" | "forgotPin" | "otp" | "newPin">("phone");
  const [authHint, setAuthHint] = useState("");
  const [authError, setAuthError] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);

  async function continuePhone() {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    setAuthError("");
    setAuthHint("");
    if (cleanPhone.length !== 10) {
      setAuthError("Enter a 10-digit mobile number.");
      return;
    }
    setLoadingAuth(true);
    try {
      const found = await authApi.lookupPhone(cleanPhone);
      if (!found.onCommittee) {
        setAuthError("This number is not on the committee.");
        return;
      }
      if (found.pinSet === false) {
        await startOtp(cleanPhone, "FIRST_LOGIN", found.firstName || "Committee member");
        return;
      }
      setPhone(cleanPhone);
      setAuthHint(`${found.firstName || "Committee member"} · enter M-PIN`);
      setAuthStep("pin");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "This number is not on the committee.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function startOtp(targetPhone: string, purpose: "FIRST_LOGIN" | "PIN_RESET", firstName?: string) {
    const cleanPhone = targetPhone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setAuthError("Enter a 10-digit mobile number first.");
      return;
    }
    setLoadingAuth(true);
    setAuthError("");
    try {
      await authApi.requestOtp(cleanPhone, purpose);
      setPhone(cleanPhone);
      setOtpPurpose(purpose);
      setOtp("");
      setResetToken("");
      setAuthHint(
        purpose === "FIRST_LOGIN"
          ? `${firstName || "Committee member"} · enter the first-login OTP`
          : "Enter the reset OTP sent on your registered number"
      );
      setAuthStep("otp");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not request OTP.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function verifyOtp() {
    if (otp.length < 4) return;
    setLoadingAuth(true);
    setAuthError("");
    try {
      const verified = await authApi.verifyOtp(phone, otp);
      setResetToken(verified.resetToken);
      setNewPin("");
      setAuthHint(otpPurpose === "FIRST_LOGIN" ? "Set your first 4-digit M-PIN" : "Set a new 4-digit M-PIN");
      setAuthStep("newPin");
    } catch (error) {
      setOtp("");
      setAuthError(error instanceof Error ? error.message : "Invalid OTP.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function saveNewPin() {
    if (newPin.length !== 4 || !resetToken) return;
    setLoadingAuth(true);
    setAuthError("");
    try {
      await setPinAndSignIn(phone, resetToken, newPin);
    } catch (error) {
      setNewPin("");
      setAuthError(error instanceof Error ? error.message : "Could not set M-PIN.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function login() {
    if (pin.length !== 4) return;
    setLoadingAuth(true);
    setAuthError("");
    try {
      await signIn(phone, pin);
    } catch (error) {
      setPin("");
      setAuthError(error instanceof Error ? error.message : "Wrong M-PIN.");
    } finally {
      setLoadingAuth(false);
    }
  }

  useEffect(() => {
    if (pin.length === 4) login();
  }, [pin]);

  useEffect(() => {
    if (otp.length === 6) verifyOtp();
  }, [otp]);

  useEffect(() => {
    if (newPin.length === 4) saveNewPin();
  }, [newPin]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.authScreen} keyboardShouldPersistTaps="handled">
        <Image source={require("../../../uploads/logo-1784996881407.jpeg")} style={styles.logo} />
        <Text style={styles.authTitle}>Market Association Record</Text>
        <Text style={styles.eyebrow}>Committee sign-in</Text>

        {authStep === "phone" ? (
          <View style={styles.authPanel}>
            <Text style={styles.label}>Registered mobile number</Text>
            <View style={styles.phoneInput}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 10))}
                keyboardType="number-pad"
                placeholder="10-digit number"
                style={styles.input}
                maxLength={10}
              />
            </View>
            <PrimaryButton label="Continue" loading={loadingAuth} onPress={continuePhone} />
            {/* <Text style={styles.devNote}>Set EXPO_PUBLIC_API_BASE_URL in .env to point this app at your backend.</Text> */}
            <Text style={styles.devNote}>8451963620</Text>
          </View>
        ) : null}

        {authStep === "pin" ? (
          <View style={styles.authPanel}>
            <Text style={styles.authHint}>{authHint}</Text>
            <PinDots length={pin.length} />
            <Keypad value={pin} setValue={setPin} />
            <View style={styles.authLinks}>
              <Pressable onPress={() => { setAuthStep("phone"); setPin(""); }}>
                <Text style={styles.mutedAction}>Change number</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAuthError("");
                  setAuthHint("Reset your M-PIN with an OTP");
                  setAuthStep("forgotPin");
                }}
              >
                <Text style={styles.linkAction}>Forgot M-PIN?</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {authStep === "forgotPin" ? (
          <View style={styles.authPanel}>
            <Text style={styles.authHint}>{authHint}</Text>
            <Text style={styles.label}>Registered mobile number</Text>
            <View style={styles.phoneInput}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 10))}
                keyboardType="number-pad"
                placeholder="10-digit number"
                style={styles.input}
                maxLength={10}
              />
            </View>
            <PrimaryButton label="Send OTP" loading={loadingAuth} onPress={() => startOtp(phone, "PIN_RESET")} />
            <View style={styles.authLinks}>
              <Pressable onPress={() => { setAuthStep("pin"); setAuthError(""); }}>
                <Text style={styles.mutedAction}>Back to M-PIN</Text>
              </Pressable>
              <Pressable onPress={() => { setAuthStep("phone"); setPin(""); setAuthError(""); }}>
                <Text style={styles.linkAction}>Change number</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {authStep === "otp" ? (
          <View style={styles.authPanel}>
            <Text style={styles.authHint}>{authHint}</Text>
            <Text style={styles.devNote}>In development, the OTP is printed in the backend terminal as DEV OTP.</Text>
            <View style={styles.phoneInput}>
              <TextInput
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 8))}
                keyboardType="number-pad"
                placeholder="OTP code"
                style={styles.input}
                maxLength={8}
              />
            </View>
            <PrimaryButton label="Verify OTP" loading={loadingAuth} onPress={verifyOtp} />
            <View style={styles.authLinks}>
              <Pressable onPress={() => { setAuthStep("phone"); setOtp(""); }}>
                <Text style={styles.mutedAction}>Change number</Text>
              </Pressable>
              <Pressable onPress={() => startOtp(phone, otpPurpose)}>
                <Text style={styles.linkAction}>Resend OTP</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {authStep === "newPin" ? (
          <View style={styles.authPanel}>
            <Text style={styles.authHint}>{authHint}</Text>
            <PinDots length={newPin.length} />
            <Keypad value={newPin} setValue={setNewPin} />
            <PrimaryButton label="Set M-PIN" loading={loadingAuth} onPress={saveNewPin} />
          </View>
        ) : null}

        {!!authError && <Text style={styles.error}>{authError}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
