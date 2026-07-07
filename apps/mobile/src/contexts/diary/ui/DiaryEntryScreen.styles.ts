import { StyleSheet } from "react-native";
import { colors, radius, spacing, type } from "../../../design-system/tokens";

export const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  sectionTitle: { ...type.sectionTitle, marginTop: spacing.xs },
  optional: { ...type.body, color: colors.textMuted },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  categoryTile: { width: "29.5%", aspectRatio: 1, minHeight: 92, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  categoryTileActive: { backgroundColor: colors.surfacePeach, borderColor: colors.salmon },
  categoryLabel: { ...type.bodyStrong },
  scorePicker: { flexDirection: "row", gap: spacing.sm },
  scoreButton: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scoreButtonActive: { borderColor: colors.orange, backgroundColor: colors.surfacePeach },
  scoreText: { ...type.bodyStrong, color: colors.textMuted },
  scoreTextActive: { color: colors.orangeDeep },
  memoBox: { minHeight: 108, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, padding: spacing.md },
  memoInput: { ...type.body, minHeight: 68, textAlignVertical: "top" },
  counter: { ...type.caption, textAlign: "right" },
  photoEditNotice: { ...type.caption, color: colors.textMuted },
  actionStack: { gap: spacing.sm },
  dangerButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.coral, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  dangerButtonText: { ...type.bodyStrong, color: colors.coral },
});
