import { StyleSheet } from "react-native";
import { colors, font, layout, radius, sceneColors, spacing, type } from "../../design-system/tokens";

export const styles = StyleSheet.create({
  screen: { gap: spacing.md, paddingTop: spacing.xxs },
  recordPanel: { gap: spacing.sm },
  hint: { ...type.caption, color: colors.textMuted },
  sectionTitle: { ...type.sectionTitle, marginTop: spacing.xs },
  toggle: { minHeight: layout.minTouch, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: spacing.xs, maxWidth: 170 },
  toggleOn: { backgroundColor: colors.surfacePeach, borderColor: colors.segmentActiveBorder },
  togglePressed: { opacity: 0.72 },
  toggleText: { ...type.caption, color: colors.textMuted, fontWeight: font.weight.semibold, flexShrink: 1 },
  toggleTextOn: { color: colors.pendingText },
  emptyCard: { marginTop: spacing.xs, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: sceneColors.wall },
  emptyArt: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md, opacity: 0.55, marginBottom: spacing.xs },
  emptyTitle: { ...type.sectionTitle, textAlign: "center" },
  emptyCopy: { ...type.body, color: colors.textMuted, textAlign: "center" },
  emptyAction: { alignSelf: "stretch", marginTop: spacing.sm },
});
