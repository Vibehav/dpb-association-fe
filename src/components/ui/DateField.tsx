import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, MIN_TOUCH, radii, spacing, typography } from "../../theme";
import { dateToIso, formatDate, isoToDate } from "../../utils/format";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

type Props = {
  label: string;
  /** `YYYY-MM-DD`, or null when nothing is chosen. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** `YYYY-MM-DD` limits — e.g. "never in the future" for a spending. */
  minimumDate?: string;
  maximumDate?: string;
  /** Shown when `value` is null. */
  placeholder?: string;
  /** Offers a Clear action — for an optional date like an event's end. */
  clearable?: boolean;
  error?: string | null;
};

/**
 * A date, chosen from the phone's own calendar — never typed. Values cross the network as
 * plain `YYYY-MM-DD`, with no time or zone.
 *
 * Android opens the system date dialog. iOS (not a target yet) gets the inline calendar in a
 * sheet, so the field still works there.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate, placeholder, clearable, error }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const current = value ? isoToDate(value) : maximumDate ? isoToDate(maximumDate) : new Date();
  const limits = {
    minimumDate: minimumDate ? isoToDate(minimumDate) : undefined,
    maximumDate: maximumDate ? isoToDate(maximumDate) : undefined
  };

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        ...limits,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === "set" && date) onChange(dateToIso(date));
        }
      });
      return;
    }
    setIosDraft(current);
    setIosOpen(true);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={typography.eyebrow}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.input, Boolean(error) && styles.inputError]}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder ?? "not set"}`}
        >
          <Text style={value ? styles.value : styles.placeholder}>{value ? formatDate(value) : placeholder ?? "Choose a date"}</Text>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        </Pressable>
        {clearable && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS !== "android" ? (
        <Sheet visible={iosOpen} onClose={() => setIosOpen(false)} title={label}>
          <DateTimePicker
            value={iosDraft}
            mode="date"
            display="inline"
            {...limits}
            onChange={(_event, date) => {
              if (date) setIosDraft(date);
            }}
          />
          <Button
            label="Done"
            onPress={() => {
              setIosOpen(false);
              onChange(dateToIso(iosDraft));
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md
  },
  inputError: { borderColor: colors.error },
  value: { fontSize: 15, color: colors.text },
  placeholder: { fontSize: 15, color: colors.muted },
  clear: { ...typography.bodySmall, color: colors.primary },
  error: { ...typography.bodySmall, color: colors.error }
});
