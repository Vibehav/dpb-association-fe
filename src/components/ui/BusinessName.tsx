import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { colors } from "../../theme";

/**
 * A shop's trading name, or a visible placeholder when none is on record.
 *
 * The name became optional in client revision v1 — registration often happens before the
 * trading name is settled, and a null is an honest "not recorded yet" where the placeholder
 * people used to type ("NA") was indistinguishable from a real name.
 *
 * Every place a shop is listed already shows its **number** beside the name, so this does not
 * fall back to the number — that would render "A-31" twice. It says the name is missing
 * instead, in muted text, which is the point of allowing the gap: it invites the correction.
 * Use {@link shopTitle} where a shop has to be named on its own, such as an accessibility
 * label.
 */
export function BusinessName({
  businessName,
  style,
  numberOfLines
}: {
  businessName: string | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const name = businessName?.trim();
  return (
    <Text style={[style, !name && styles.unnamed]} numberOfLines={numberOfLines}>
      {name || "Name not recorded"}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Muted and italic so it reads as an absent value rather than as the shop's actual name.
  unnamed: { color: colors.muted, fontStyle: "italic" }
});
