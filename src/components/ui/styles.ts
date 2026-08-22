import { StyleSheet } from "react-native";
import { colors } from "../../theme";

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  authScreen: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: "center",
    marginBottom: 16
  },
  authTitle: {
    fontSize: 30,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center"
  },
  eyebrow: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.muted,
    textAlign: "center",
    textTransform: "uppercase"
  },
  authPanel: {
    marginTop: 34,
    gap: 14
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.7,
    color: colors.muted,
    textTransform: "uppercase"
  },
  phoneInput: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14
  },
  countryCode: {
    color: colors.muted,
    fontWeight: "600",
    marginRight: 8
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text
  },
  authHint: {
    textAlign: "center",
    color: colors.success,
    fontSize: 14
  },
  authLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 22
  },
  authLinkCenter: {
    alignItems: "center"
  },
  mutedAction: {
    color: colors.muted,
    fontSize: 13
  },
  linkAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600"
  },
  error: {
    marginTop: 14,
    color: colors.error,
    textAlign: "center"
  },
  devNote: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.soft,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "600",
    color: colors.text
  },
  headerSub: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: colors.white,
    fontWeight: "700"
  },
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.noticeSoft,
    color: colors.noticeText,
    fontSize: 12
  },
  content: {
    flex: 1
  },
  contentInner: {
    padding: 16,
    paddingBottom: 98
  },
  stack: {
    gap: 14
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 20
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    gap: 8
  },
  smallCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14
  },
  row: {
    flexDirection: "row",
    gap: 12
  },
  cardEyebrow: {
    fontSize: 10,
    letterSpacing: 0.7,
    color: colors.muted,
    textTransform: "uppercase",
    fontWeight: "700"
  },
  orange: {
    color: colors.warning
  },
  balanceText: {
    marginTop: 8,
    fontSize: 40,
    color: colors.white,
    fontWeight: "600"
  },
  cardTitle: {
    fontSize: 21,
    color: colors.text,
    fontWeight: "600"
  },
  cardHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  bodyText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 19
  },
  splitRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 8
  },
  metric: {
    flex: 1
  },
  metricLabel: {
    fontSize: 10,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  metricLabelLight: {
    color: "rgba(255,255,255,0.65)"
  },
  metricValue: {
    marginTop: 4,
    color: colors.text,
    fontWeight: "700",
    fontSize: 14
  },
  metricValueLight: {
    color: colors.white
  },
  smallValue: {
    marginTop: 5,
    color: colors.text,
    fontWeight: "700",
    fontSize: 24
  },
  danger: {
    color: colors.error
  },
  searchBox: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text
  },
  countLine: {
    color: colors.muted,
    fontSize: 12
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  chipPaid: {
    backgroundColor: colors.successSoft
  },
  chipDue: {
    backgroundColor: colors.errorSoft
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700"
  },
  chipTextPaid: {
    color: colors.success
  },
  chipTextDue: {
    color: colors.error
  },
  mono: {
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    color: colors.text
  },
  personTitle: {
    flex: 1
  },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.soft,
    color: colors.secondaryText,
    textTransform: "capitalize",
    fontSize: 12
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15
  },
  pinDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginVertical: 10
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.primary
  },
  pinDotFilled: {
    backgroundColor: colors.primary
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center"
  },
  key: {
    width: "30%",
    aspectRatio: 1.35,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  keyBlank: {
    opacity: 0
  },
 keyText: {
  fontSize: 24,
  color: colors.text,
  fontWeight: "600",
  includeFontPadding: false,
  textAlignVertical: "center",
},
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-around"
  },
  tabButton: {
    minWidth: 58,
    alignItems: "center",
    gap: 3
  },
  tabLabel: {
    fontSize: 11,
    color: colors.muted
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "700"
  }
});
