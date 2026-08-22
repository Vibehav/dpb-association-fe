import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radii } from "../../theme";
import { initials } from "../../utils/format";

type Props = {
  name: string;
  size?: number;
};

/**
 * Initials avatar. The people list carries no photo, so rows identify by initials
 * (integration doc §11).
 */
export function Avatar({ name, size = 38 }: Props) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: radii.pill }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.text, { fontSize: size * 0.34 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  text: { fontFamily: fontFamilies.monoMedium, color: colors.primary }
});
