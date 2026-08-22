import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "../../theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** State the consequence plainly — "this unlinks everyone at the shop". */
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
};

/** Confirmation for an irreversible action. Always spells out what will happen. */
export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  destructive,
  loading
}: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Button
          label={confirmLabel}
          variant={destructive ? "danger" : "primary"}
          loading={loading}
          onPress={onConfirm}
        />
        <Button label="Cancel" variant="secondary" onPress={onClose} disabled={loading} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  message: { ...typography.body },
  actions: { gap: spacing.sm }
});
