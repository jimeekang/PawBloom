import { StyleSheet } from "react-native";
import { colors, font, layout, radius, spacing, type } from "../../design-system/tokens";

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
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...type.caption,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  speciesPill: {
    minHeight: 40,
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
    fontWeight: font.weight.semibold,
  },
  input: {
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  photoPicker: {
    minHeight: 82,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfacePeach,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerText: {
    ...type.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  dangerButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  dangerButtonText: {
    ...type.bodyStrong,
    color: colors.danger,
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
