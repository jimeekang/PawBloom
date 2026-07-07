import { StyleSheet, Text, View } from "react-native";
import type { ReportDraftSummary } from "../application/reportDraftRecords";
import { NoticeBanner, PrimaryButton, SecondaryButton, SurfaceCard } from "../../../design-system/components";
import { AppIcon, type AppIconName } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import type { ReportStage } from "./reportStage";
import { MockShareCard, ReportListSection, ReportMetricsCard } from "./ReportArtifactSections";

export function ReportsScreen({
  reportStage,
  reportSummary,
  onReportStageChange,
  onNewDiary,
}: {
  reportStage: ReportStage;
  reportSummary: ReportDraftSummary;
  onReportStageChange: (stage: ReportStage) => void;
  onNewDiary: () => void;
}) {
  const stage = stageCopy[reportStage];
  const conditionTrend = conditionTrendCopy(reportSummary);

  return (
    <View style={styles.screen}>
      <NoticeBanner text={t("ko", stage.noticeKey)} icon={reportStage === "shared" ? "share" : "shield"} />

      <SurfaceCard>
        <View style={styles.reportHeader}>
          <View style={styles.reportIcon}>
            <AppIcon name="reports" size={iconSize.lg} color={colors.orangeDeep} />
          </View>
          <View style={styles.reportHeading}>
            <Text style={styles.title}>{t("ko", stage.titleKey)}</Text>
            <Text style={styles.caption}>{t("ko", "reports.rangeLabel")}</Text>
          </View>
        </View>
        <Text style={styles.summary}>
          {reportSummary.hasRecords ? buildReportSummaryCopy(reportSummary) : t("ko", "reports.emptyCopy")}
        </Text>
        <View style={styles.notice}>
          <AppIcon name="shield" size={iconSize.sm} color={colors.orangeDeep} />
          <Text style={styles.noticeText}>{t("ko", "briefing.disclaimer")}</Text>
        </View>
        {reportSummary.hasRecords ? (
          <View style={styles.previewBlock}>
            <Text style={styles.blockLabel}>{t("ko", "reports.englishPreview")}</Text>
            <Text style={styles.previewText}>{reportSummary.englishPreview}</Text>
          </View>
        ) : null}
      </SurfaceCard>

      {reportSummary.hasRecords ? (
        <>
          <ReportListSection icon="time" title={t("ko", "reports.timelineHighlights")} items={reportSummary.timelineHighlights} />
          <ReportListSection
            icon="shield"
            title={t("ko", "reports.missingRecords")}
            items={reportSummary.missingRecords.length > 0 ? reportSummary.missingRecords : [t("ko", "reports.noMissingRecords")]}
          />
          <ReportListSection icon="condition" title={t("ko", "reports.vetQuestions")} items={reportSummary.vetQuestions} />

          <ReportMetricsCard summary={reportSummary} conditionTrend={conditionTrend} />

          <SurfaceCard>
            <Text style={styles.title}>{t("ko", "reports.beforeSharing")}</Text>
            <View style={styles.checkRow}>
              <AppIcon name="check" size={iconSize.sm} color={colors.mintDeep} />
              <Text style={styles.body}>{t("ko", "reports.confirmMedication")}</Text>
            </View>
            <View style={styles.checkRow}>
              <AppIcon name="check" size={iconSize.sm} color={colors.mintDeep} />
              <Text style={styles.body}>{t("ko", "reports.reviewNotes")}</Text>
            </View>
          </SurfaceCard>

          {reportStage === "shared" ? <MockShareCard /> : null}
        </>
      ) : (
        <SurfaceCard>
          <Text style={styles.title}>{t("ko", "reports.emptyTitle")}</Text>
          <Text style={styles.emptyText}>{t("ko", "reports.emptyState")}</Text>
        </SurfaceCard>
      )}

      <View style={styles.actions}>
        <PrimaryButton label={t("ko", stage.primaryLabelKey)} icon={stage.primaryIcon} onPress={() => onReportStageChange(stage.next)} />
        <SecondaryButton label={t("ko", "reports.addMoreRecords")} icon="diary" onPress={onNewDiary} />
      </View>
    </View>
  );
}

function buildReportSummaryCopy(summary: ReportDraftSummary) {
  return t("ko", "reports.realSummary")
    .replace("{diaryCount}", `${summary.diaryCount}`)
    .replace("{medicationCount}", `${summary.medicationCount}`)
    .replace("{attentionCount}", `${summary.medicationAttentionCount}`);
}

function conditionTrendCopy(summary: ReportDraftSummary) {
  const { latestScore, previousScore, direction } = summary.conditionTrend;
  if (!latestScore) {
    return t("ko", "reports.conditionTrend.none");
  }

  const scoreCopy = previousScore ? `${previousScore} -> ${latestScore}` : `${latestScore}/5`;
  return `${scoreCopy} ${t("ko", conditionTrendKey[direction])}`;
}

const conditionTrendKey: Record<ReportDraftSummary["conditionTrend"]["direction"], TranslationKey> = {
  none: "reports.conditionTrend.none",
  stable: "reports.conditionTrend.stable",
  improving: "reports.conditionTrend.improving",
  declining: "reports.conditionTrend.declining",
};

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
  previewBlock: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  blockLabel: {
    ...type.caption,
    color: colors.orangeDeep,
    fontWeight: "700",
  },
  previewText: {
    ...type.body,
    color: colors.text,
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
  emptyText: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
