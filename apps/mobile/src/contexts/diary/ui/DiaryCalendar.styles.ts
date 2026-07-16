import { StyleSheet } from "react-native";
import { colors, font, radius, spacing, type } from "../../../design-system/tokens";

export const styles = StyleSheet.create({
  selectedDateButton: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  selectedDateButtonPressed: {
    opacity: 0.72,
  },
  selectedDateBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  selectedDateText: {
    ...type.bodyStrong,
    flex: 1,
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronExpanded: {
    transform: [{ rotate: "180deg" }],
  },
  calendarBody: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  monthTitle: {
    ...type.sectionTitle,
  },
  monthButton: {
    minHeight: 44,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonText: {
    ...type.caption,
    color: colors.orangeDeep,
    fontWeight: font.weight.semibold,
  },
  weekHeader: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  weekLabel: {
    ...type.tiny,
    flex: 1,
    textAlign: "center",
  },
  grid: {
    gap: spacing.xs,
  },
  weekRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.segmentActiveBorder,
  },
  daySelected: {
    backgroundColor: colors.orange,
  },
  dayText: {
    ...type.caption,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  dayMuted: {
    color: colors.textSoft,
  },
  dayTextSelected: {
    color: colors.white,
  },
});
