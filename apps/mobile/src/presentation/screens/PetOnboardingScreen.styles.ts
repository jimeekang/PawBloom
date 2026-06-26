import { StyleSheet } from "react-native";
import { colors, layout, radius, spacing, type } from "../../design-system/tokens";

export const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  scrollContent: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  title: {
    ...type.heroTitle,
    color: colors.text,
  },
  copy: {
    ...type.body,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  helpText: {
    ...type.caption,
    color: colors.textMuted,
  },
  petRow: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  petRowActive: {
    borderColor: colors.orangeDeep,
    backgroundColor: colors.surfacePeach,
  },
  petTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  petName: {
    ...type.bodyStrong,
    color: colors.text,
  },
  petMeta: {
    ...type.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  speciesPill: {
    minHeight: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  speciesPillActive: {
    borderColor: colors.orangeDeep,
    backgroundColor: colors.surfacePeach,
  },
  speciesText: {
    ...type.caption,
    color: colors.textMuted,
  },
  speciesTextActive: {
    color: colors.orangeDeep,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  actionRow: {
    marginTop: spacing.xs,
  },
  loadingText: {
    ...type.caption,
    color: colors.orangeDeep,
    textAlign: "center",
  },
});
