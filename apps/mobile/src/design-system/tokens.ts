import { Platform } from "react-native";

export const colors = {
  appBackground: "#FFFCF7",
  surface: "#FFFFFF",
  surfaceWarm: "#FFF8F1",
  surfacePeach: "#FFF1EA",
  border: "#E9E1D8",
  borderStrong: "#DED4C9",
  borderDashed: "#D8C8B8",
  segmentActiveBorder: "#FFC9B9",
  text: "#171A22",
  textMuted: "#6F7077",
  textSoft: "#9A9690",
  white: "#FFFFFF",
  orange: "#FFA733",
  orangeDeep: "#F47D38",
  coral: "#FF7778",
  salmon: "#FF8C85",
  mint: "#73D7BE",
  mintDeep: "#4BB58F",
  water: "#68C6EF",
  walk: "#68C992",
  stool: "#B37836",
  memo: "#F3BB75",
  purple: "#8B77D6",
  summaryBg: "#E9FAFF",
  summaryBorder: "#B8EEF5",
  summaryAccent: "#2196B0",
  summaryPaw: "#2CB6C1",
  diagnosis: "#0E3E69",
  inactive: "#D4D0CB",
  shadow: "#211B16",
  heroScrim: "rgba(0, 0, 0, 0.08)",
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 999,
} as const;

export const iconSize = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 32,
  xl: 42,
} as const;

export const font = {
  family: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    heavy: "800",
  },
} as const;

export const type = {
  brand: { fontSize: 25, lineHeight: 32, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: 0 },
  screenTitle: { fontSize: 18, lineHeight: 24, fontWeight: font.weight.semibold, color: colors.text, letterSpacing: 0 },
  heroTitle: { fontSize: 34, lineHeight: 39, fontWeight: font.weight.heavy, color: colors.white, letterSpacing: 0 },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: font.weight.semibold, color: colors.text, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: font.weight.regular, color: colors.text, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: font.weight.semibold, color: colors.text, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: font.weight.regular, color: colors.textMuted, letterSpacing: 0 },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: font.weight.medium, color: colors.textMuted, letterSpacing: 0 },
} as const;

export const layout = {
  screenPadding: 20,
  bottomNavHeight: 78,
  heroHeight: 340,
  inputHeight: 54,
  buttonHeight: 54,
  categoryTile: 110,
} as const;

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
} as const;
