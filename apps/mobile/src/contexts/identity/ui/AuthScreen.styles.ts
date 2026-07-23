import { StyleSheet } from "react-native";
import { colors, layout, radius, spacing, type } from "../../../design-system/tokens";

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  langRow: {
    alignSelf: "flex-end",
    width: 200,
  },
  title: {
    ...type.heroTitle,
    color: colors.text,
  },
  copy: {
    ...type.body,
    color: colors.text,
  },
  valuePanel: {
    gap: spacing.sm,
  },
  valueRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  valueIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.surfacePeach,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    ...type.bodyStrong,
    flex: 1,
  },
  trustCopy: {
    ...type.caption,
    color: colors.textMuted,
  },
  form: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.xs,
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
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    ...type.caption,
    color: colors.textMuted,
  },
  notice: {
    ...type.caption,
    color: colors.orangeDeep,
  },
});
