import { StyleSheet, Text, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton, SurfaceCard } from "../../design-system/components";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t, type TranslationKey } from "../../i18n/translations";
import type { ReportStage } from "../mockUiState";

export function ReportsScreen({
  reportStage,
  onReportStageChange,
  onNewDiary,
}: {
  reportStage: ReportStage;
  onReportStageChange: (stage: ReportStage) => void;
  onNewDiary: () => void;
}) {
  const stage = stageCopy[reportStage];

  return (
    <View style={styles.screen}>
      <NoticeBanner text={t("en", stage.noticeKey)} icon={reportStage === "shared" ? "share" : "shield"} />

      <SurfaceCard>
        <View style={styles.reportHeader}>
          <View style={styles.reportIcon}>
            <AppIcon name="reports" size={iconSize.lg} color={colors.orangeDeep} />
          </View>
          <View style={styles.reportHeading}>
            <Text style={styles.title}>{t("en", stage.titleKey)}</Text>
            <Text style={styles.caption}>{t("en", "reports.rangeLabel")}</Text>
          </View>
        </View>
        <Text style={styles.summary}>
          {t("en", "reports.summaryCopy")}
        </Text>
        <View style={styles.notice}>
          <AppIcon name="shield" size={iconSize.sm} color={colors.orangeDeep} />
          <Text style={styles.noticeText}>{t("en", "briefing.disclaimer")}</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.title}>{t("en", "reports.beforeSharing")}</Text>
        <View style={styles.checkRow}>
          <AppIcon name="check" size={iconSize.sm} color={colors.mintDeep} />
          <Text style={styles.body}>{t("en", "reports.confirmMedication")}</Text>
        </View>
        <View style={styles.checkRow}>
          <AppIcon name="check" size={iconSize.sm} color={colors.mintDeep} />
          <Text style={styles.body}>{t("en", "reports.reviewNotes")}</Text>
        </View>
      </SurfaceCard>

      <View style={styles.actions}>
        <PrimaryButton label={t("en", stage.primaryLabelKey)} icon={stage.primaryIcon} onPress={() => onReportStageChange(stage.next)} />
        <SecondaryButton label={t("en", "reports.addMoreRecords")} icon="diary" onPress={onNewDiary} />
      </View>
    </View>
  );
}

const stageCopy: Record<
  ReportStage,
  { titleKey: TranslationKey; noticeKey: TranslationKey; primaryLabelKey: TranslationKey; primaryIcon: AppIconName; next: ReportStage }
> = {
  empty: {
    titleKey: "reports.previewTitle",
    noticeKey: "reports.previewNotice",
    primaryLabelKey: "reports.generatePreview",
    primaryIcon: "report",
    next: "draft",
  },
  draft: {
    titleKey: "reports.draftTitle",
    noticeKey: "reports.draftNotice",
    primaryLabelKey: "reports.confirmDraft",
    primaryIcon: "check",
    next: "confirmed",
  },
  confirmed: {
    titleKey: "reports.confirmedTitle",
    noticeKey: "reports.confirmedNotice",
    primaryLabelKey: "reports.createShareLink",
    primaryIcon: "share",
    next: "shared",
  },
  shared: {
    titleKey: "reports.sharedTitle",
    noticeKey: "reports.sharedNotice",
    primaryLabelKey: "reports.resetPreview",
    primaryIcon: "report",
    next: "draft",
  },
};

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  reportHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  reportIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfacePeach,
    alignItems: "center",
    justifyContent: "center",
  },
  reportHeading: {
    flex: 1,
  },
  title: {
    ...type.sectionTitle,
  },
  caption: {
    ...type.caption,
    marginTop: spacing.xs,
  },
  summary: {
    ...type.body,
    marginTop: spacing.lg,
  },
  notice: {
    marginTop: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.summaryBg,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  noticeText: {
    ...type.caption,
    flex: 1,
    color: colors.diagnosis,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  body: {
    ...type.body,
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
});
