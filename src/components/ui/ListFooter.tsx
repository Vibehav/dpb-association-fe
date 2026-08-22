import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme";
import { Button } from "./Button";

type Props = {
  loading: boolean;
  hasMore: boolean;
  /** Present when fetching the *next* page failed — the loaded pages stay on screen. */
  error?: unknown;
  onRetry?: () => void;
  /** Shown when everything has been loaded and there is more than one page. */
  endLabel?: string;
};

/** Footer for a paginated list. Never silently stops — the user always knows why. */
export function ListFooter({ loading, hasMore, error, onRetry, endLabel }: Props) {
  if (loading) {
    return (
      <View style={styles.wrapper}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.text}>Couldn&apos;t load more.</Text>
        {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
      </View>
    );
  }

  if (!hasMore && endLabel) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.text}>{endLabel}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrapper: { paddingVertical: spacing.lg, alignItems: "center", gap: spacing.sm },
  text: { ...typography.bodySmall }
});
