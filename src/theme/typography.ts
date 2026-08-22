import type { TextStyle } from "react-native";
import { colors } from "./colors";
import { fontFamilies } from "./fonts";

/**
 * The type scale, lifted from the prototype's inline styles so screens stop hand-rolling
 * font sizes. Sizes are the prototype's own (it was laid out at 390pt wide).
 */
export const typography = {
  /** Association name on the sign-in screen. */
  display: {
    fontFamily: fontFamilies.serif,
    fontSize: 25,
    lineHeight: 30,
    color: colors.text
  } satisfies TextStyle,

  /** Screen titles. */
  title: {
    fontFamily: fontFamilies.serif,
    fontSize: 20,
    lineHeight: 25,
    color: colors.text
  } satisfies TextStyle,

  /** Card headings — shop number, member name. */
  cardTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    fontWeight: "500",
    color: colors.text
  } satisfies TextStyle,

  body: {
    fontFamily: fontFamilies.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.secondaryText
  } satisfies TextStyle,

  bodySmall: {
    fontFamily: fontFamilies.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted
  } satisfies TextStyle,

  /** Small uppercase mono label above a value. */
  eyebrow: {
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.muted
  } satisfies TextStyle,

  /** Numbers, phone numbers, shop numbers — anything that should align. */
  mono: {
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    color: colors.text
  } satisfies TextStyle,

  monoSmall: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: colors.muted
  } satisfies TextStyle,

  button: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    fontWeight: "500",
    color: colors.white
  } satisfies TextStyle,

  tabLabel: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 0.2
  } satisfies TextStyle
};
