import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { ApiError, errorMessage } from "../../api";
import { colors, spacing, typography } from "../../theme";
import { Button } from "./Button";

type Props = {
  error: unknown;
  onRetry?: () => void;
  /** Shown above the message, e.g. "Couldn't load shops". */
  title?: string;
};

/**
 * A failure, shown as a failure.
 *
 * The previous implementation caught list errors and substituted `mockData`, so a dropped
 * request rendered five invented shops as though they were the register. The functional
 * spec (§13.4) is explicit: every failure needs a plain message and a way forward, and
 * nothing may look like it succeeded when it didn't.
 */
export function ErrorState({ error, onRetry, title }: Props) {
  const offline = error instanceof ApiError && error.isNetworkFailure;

  return (
    <View style={styles.wrapper}>
      <Ionicons
        name={offline ? "cloud-offline-outline" : "alert-circle-outline"}
        size={32}
        color={colors.muted}
      />
      <Text style={styles.title}>{title ?? (offline ? "No connection" : "Something went wrong")}</Text>
      <Text style={styles.message}>{errorMessage(error)}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl },
  title: { ...typography.cardTitle, textAlign: "center" },
  message: { ...typography.body, textAlign: "center", paddingHorizontal: spacing.lg }
});
