import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, MIN_TOUCH, radii, spacing, typography } from "../../theme";
import { Button } from "../ui/Button";
import { Chip, ChipRow } from "../ui/Chip";
import { SearchBox } from "../ui/SearchBox";
import { Sheet } from "../ui/Sheet";

/** One single-choice filter. `null` in the values means "no filter" for that section. */
export type FilterSection = {
  key: string;
  title: string;
  /** The "no filter" choice, e.g. "All roles". */
  anyLabel: string;
  options: { value: string; label: string }[];
};

export type FilterValues = Record<string, string | null>;

type Props = {
  term: string;
  onChangeTerm: (term: string) => void;
  placeholder: string;
  sections: FilterSection[];
  values: FilterValues;
  onChangeValues: (values: FilterValues) => void;
};

/**
 * A list's search box with its filters tucked behind a Filter button.
 *
 * The lists used to show every filter as an open chip row under the search box — People had
 * three, Shops two — which pushed the first result well down the screen before anyone had
 * asked to filter anything. Now the choices live in a sheet, applied together, and only the
 * filters actually in force show under the search box, each removable with one tap. With
 * none set, the search box sits straight on top of the list.
 */
export function SearchWithFilters({ term, onChangeTerm, placeholder, sections, values, onChangeValues }: Props) {
  const [open, setOpen] = useState(false);

  const active = sections.flatMap((section) => {
    const value = values[section.key];
    if (value === null || value === undefined) return [];
    const label = section.options.find((option) => option.value === value)?.label ?? value;
    return [{ key: section.key, label }];
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.search}>
          <SearchBox value={term} onChangeText={onChangeTerm} placeholder={placeholder} />
        </View>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={active.length > 0 ? `Filter, ${active.length} active` : "Filter"}
          style={({ pressed }) => [styles.filterButton, active.length > 0 && styles.filterActive, pressed && styles.pressed]}
        >
          <Ionicons name="options-outline" size={18} color={active.length > 0 ? colors.white : colors.text} />
          <Text style={[styles.filterLabel, active.length > 0 && styles.filterLabelActive]}>
            {active.length > 0 ? `Filter · ${active.length}` : "Filter"}
          </Text>
        </Pressable>
      </View>

      {active.length > 0 ? (
        <ChipRow>
          {active.map(({ key, label }) => (
            <Chip
              key={key}
              label={`${label}  ✕`}
              selected
              accessibilityLabel={`Remove filter ${label}`}
              onPress={() => onChangeValues({ ...values, [key]: null })}
            />
          ))}
        </ChipRow>
      ) : null}

      <FilterSheet
        visible={open}
        onClose={() => setOpen(false)}
        sections={sections}
        values={values}
        onApply={(next) => {
          onChangeValues(next);
          setOpen(false);
        }}
      />
    </View>
  );
}

/**
 * The choices, staged: nothing reaches the list until Apply, so trying a few options costs
 * one refetch rather than one per tap. Reopening starts from what is applied.
 */
function FilterSheet({
  visible,
  onClose,
  sections,
  values,
  onApply
}: {
  visible: boolean;
  onClose: () => void;
  sections: FilterSection[];
  values: FilterValues;
  onApply: (values: FilterValues) => void;
}) {
  const [draft, setDraft] = useState<FilterValues>(values);
  // Start from what is applied each time the sheet opens — and only then. The screens build
  // `values` fresh on every render, so depending on it would wipe the user's half-made choice
  // whenever the list behind the sheet refetched.
  const applied = useRef(values);
  applied.current = values;
  useEffect(() => {
    if (visible) setDraft(applied.current);
  }, [visible]);

  const set = (key: string, value: string | null) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Sheet visible={visible} onClose={onClose} title="Filter">
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
        {sections.map((section) => {
          const current = draft[section.key] ?? null;
          return (
            <View key={section.key} style={styles.section}>
              <Text style={typography.eyebrow}>{section.title}</Text>
              <View style={styles.options}>
                <Chip label={section.anyLabel} selected={current === null} onPress={() => set(section.key, null)} />
                {section.options.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={current === option.value}
                    // Tapping the chosen option again clears it — back to "any".
                    onPress={() => set(section.key, current === option.value ? null : option.value)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerClear}>
          <Button
            label="Clear all"
            variant="secondary"
            onPress={() => setDraft(Object.fromEntries(sections.map((section) => [section.key, null])))}
          />
        </View>
        <View style={styles.footerApply}>
          <Button label="Apply" onPress={() => onApply(draft)} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  search: { flex: 1 },
  filterButton: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  filterLabel: { fontSize: 13, color: colors.text },
  filterLabelActive: { color: colors.white },
  sheetScroll: { maxHeight: 420 },
  sheetContent: { gap: spacing.lg },
  section: { gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  footer: { flexDirection: "row", gap: spacing.sm },
  footerClear: { flexBasis: 120, flexGrow: 0 },
  footerApply: { flex: 1 }
});
