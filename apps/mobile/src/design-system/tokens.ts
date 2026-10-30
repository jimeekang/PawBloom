import { Platform } from "react-native";

export const colors = {
  appBackground: "#FAF6EF",
  surface: "#FFFFFF",
  surfaceWarm: "#FFF8F1",
  surfacePeach: "#FFF1EA",
  border: "#E9E1D8",
  borderStrong: "#DED4C9",
  borderDashed: "#D8C8B8",
  segmentActiveBorder: "#FFC9B9",
  text: "#1F1A14",
  textMuted: "#6B645A",
  // 4.54:1 on the warm surface (#FFF8F1) — the old #9C9284 sat at 2.9:1,
  // below AA for the placeholders and captions that use it.
  textSoft: "#7C7160",
  white: "#FFFFFF",
  orange: "#E06D10",
  orangePressed: "#C25510",
  orangeDeep: "#D2600E",
  coral: "#FF7778",
  salmon: "#FF8C85",
  mint: "#73D7BE",
  mintDeep: "#4BB58F",
  water: "#68C6EF",
  walk: "#68C992",
  stool: "#B37836",
  memo: "#F3BB75",
  purple: "#8B77D6",
  danger: "#D64545",
  dangerBg: "#FFF1F0",
  dangerBorder: "#F3C1BC",
  summaryBg: "#E9FAFF",
  summaryBorder: "#B8EEF5",
  summaryAccent: "#2196B0",
  summaryPaw: "#2CB6C1",
  diagnosis: "#0E3E69",
  inactive: "#D4D0CB",
  shadow: "#211B16",
  heroScrim: "rgba(0, 0, 0, 0.32)",
  scrimStrong: "rgba(0, 0, 0, 0.92)",
  scrimSoft: "rgba(0, 0, 0, 0.55)",
  // Record status chips (0009 M4). Text colors keep 4.5:1 on their own
  // backgrounds; status is never shown by color alone (icon + label).
  successBg: "#EAF7F1",
  successText: "#2E7A5F",
  warningBg: "#FFF4E4",
  warningText: "#97570F",
  neutralBg: "#F3EFEA",
  pendingText: "#A94A0A",
} as const;

// Warm 2D house scene and default characters (0009 M3). Scene-only colors:
// UI chrome keeps `colors`. Characters are staging, never health signals.
export const sceneColors = {
  wall: "#FCEBD7",
  wallShade: "#F8E0C6",
  window: "#E6F5FB",
  windowFrame: "#F1D0AC",
  floor: "#EDC89D",
  floorLine: "#E0B786",
  baseboard: "#E2B88A",
  rug: "#F7DCCB",
  groundShadow: "rgba(110, 72, 34, 0.18)",
  dogFur: "#E7AE72",
  dogEar: "#B9773F",
  catFur: "#C8BFB6",
  catEar: "#978B80",
  otherFur: "#A6DAC6",
  otherEar: "#62B99C",
  muzzle: "#FFF4E6",
  face: "#3A2A1E",
  blush: "#F5A79C",
  nameTag: "rgba(255, 255, 255, 0.94)",
} as const;

/** Character paints only; expressions never encode health or care completion. */
export const characterColors = {
  coat: { white: "#FFF8ED", cream: "#EDD5B1", ginger: "#DF9B57", brown: "#AD7959", gray: "#B8B1AC", black: "#48434A", lilac: "#C3AFBF", chocolate: "#715345" },
  shade: { white: "#D9D3C9", cream: "#C9B596", ginger: "#BE844A", brown: "#93674C", gray: "#9C9692", black: "#3D393F", lilac: "#A695A2", chocolate: "#60473B" },
  eye: { amber: "#D3A24E", green: "#82AA7C", blue: "#7EAEC9", copper: "#B97B48", odd: "#7EAEC9" },
  collar: { none: "transparent", red: "#C77065", blue: "#729BB6", yellow: "#DBB45E", green: "#7F9F84" },
  inner: "#E3ACAA", nose: "#B97679", ink: "#342C32", highlight: "#FFFFFF", blush: "#E89991", bell: "#E9C468", outline: "#B49C82",
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
  brand: { fontSize: 25, lineHeight: 32, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.4 },
  screenTitle: { fontSize: 18, lineHeight: 24, fontWeight: font.weight.bold, color: colors.text, letterSpacing: -0.3 },
  heroTitle: { fontSize: 34, lineHeight: 40, fontWeight: font.weight.heavy, color: colors.white, letterSpacing: -0.6 },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: font.weight.semibold, color: colors.text, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: font.weight.regular, color: colors.text, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: font.weight.semibold, color: colors.text, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: font.weight.regular, color: colors.textMuted, letterSpacing: 0 },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: font.weight.medium, color: colors.textMuted, letterSpacing: 0.2 },
} as const;

export const layout = {
  screenPadding: 20,
  bottomNavHeight: 78,
  heroHeight: 340,
  inputHeight: 52,
  buttonHeight: 54,
  categoryTile: 110,
  minTouch: 44,
} as const;

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;
