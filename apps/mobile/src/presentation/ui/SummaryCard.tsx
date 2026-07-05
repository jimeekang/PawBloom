import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../design-system/iconography";
import { IconBubble } from "../../design-system/components";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export function SummaryCard() {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTitleRow}>
        <AppIcon name="spark" size={iconSize.md} color={colors.summaryAccent} />
        <Text style={styles.summaryTitle}>{t("ko", "briefing.title")}</Text>
      </View>
      <Text style={styles.summaryCopy}>{t("ko", "briefing.summaryCopy")}</Text>
      <View style={styles.diagnosisRow}>
        <AppIcon name="shield" size={iconSize.sm} color={colors.orangeDeep} />
        <Text style={styles.diagnosisText}>{t("ko", "briefing.disclaimer")}</Text>
      </View>
      <View style={styles.cloudBadge}>
        <IconBubble name="walk" color={colors.summaryPaw} background={colors.summaryBg} size={62} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    minHeight: 184,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.summaryBorder,
    backgroundColor: colors.summaryBg,
    padding: spacing.lg,
    overflow: "hidden",
  },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryTitle: {
    ...type.sectionTitle,
    color: colors.diagnosis,
  },
  summaryCopy: {
    ...type.body,
    color: colors.text,
    marginTop: spacing.md,
  },
  diagnosisRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingRight: 72,
  },
  diagnosisText: {
    ...type.caption,
    color: colors.diagnosis,
    fontWeight: "600",
    flex: 1,
  },
  cloudBadge: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.sm,
  },
});
