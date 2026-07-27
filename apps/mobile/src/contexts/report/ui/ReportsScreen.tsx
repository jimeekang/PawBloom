import { StyleSheet, Text, View } from "react-native";
import type { ReportDraftSummary } from "../application/reportDraftRecords";
import type { GeneratedVetReport } from "../application/vetReportContract";
import type { VetReportStatus } from "../domain/vetReport";
import { NoticeBanner, PrimaryButton, SecondaryButton, SurfaceCard } from "../../../design-system/components";
import { AppIcon, type AppIconName } from "../../../design-system/iconography";
import { colors, font, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { formatReportMissingRecord, formatReportTimelineItem, formatReportVetQuestion, type DiarySummaryFormatter } from "./reportDraftDisplay";
import { ReportListSection, ReportMetricsCard, ReportShareCard } from "./ReportArtifactSections";
import { createReportArtifactSnapshot, type ReportArtifactSnapshot } from "./reportArtifactSnapshot";
import { getReportPrimaryAction, type ReportWorkflowAction, type ReportWorkflowError } from "./reportWorkflow";

type Props = {
  report: GeneratedVetReport | null;
  reportSummary: ReportDraftSummary & { sourceStatus?: "ready" | "loading" | "error"; refetchSources?: () => void };
  canGenerate: boolean;
  canConfirm: boolean;
  canShare: boolean;
  blockedReason: Extract<ReportWorkflowError, "accountRequired" | "petRequired" | "empty" | "permission"> | null;
  error: ReportWorkflowError | null;
  pendingAction: ReportWorkflowAction | null;
  isBusy: boolean;
  onGenerate: () => void;
  onConfirm: () => void;
  onShare: () => void;
  onRevoke: () => void | Promise<void>;
  onReset: () => void;
  onNewDiary: () => void;
  onRetryLoad?: () => void;
  formatDiarySummary?: DiarySummaryFormatter;
};

export function ReportsScreen({ report, reportSummary, canGenerate, canConfirm, canShare, blockedReason, error, pendingAction, isBusy, onGenerate, onConfirm, onShare, onRevoke, onReset, onNewDiary, onRetryLoad, formatDiarySummary }: Props) {
  const { language } = useLanguage();
  const stage = report?.status ?? "empty";
  const stageContent = stageCopy[stage];
  const artifactSnapshot = report ? createReportArtifactSnapshot(report.payload) : null;
  const displayedSummary = artifactSnapshot ?? reportSummary;
  const hasDisplayedRecords = Boolean(report) || reportSummary.hasRecords;
  const conditionTrend = conditionTrendCopy(displayedSummary);
  const primaryAction = getReportPrimaryAction({ report, hasRecords: hasDisplayedRecords, canGenerate, canConfirm, canShare, isBusy });
  const visibleError = error ?? (blockedReason === "empty" ? null : blockedReason);
  const preview = report?.englishSummary ?? reportSummary.englishPreview;

  function runPrimaryAction() {
    if (primaryAction === "generate") onGenerate();
    if (primaryAction === "confirm") onConfirm();
    if (primaryAction === "share") onShare();
  }

  return (
    <View style={styles.screen}>
      <NoticeBanner text={t(stageContent.noticeKey)} icon={stage === "shared" ? "share" : "shield"} />
      {report?.status === "draft" && !canConfirm ? <NoticeBanner text={t("permission.reportOwnerConfirmation")} icon="shield" /> : null}
      {visibleError ? <NoticeBanner text={t(workflowErrorKey[visibleError])} icon="close" tone="error" /> : null}
      {visibleError === "load" && onRetryLoad ? <SecondaryButton label={t("diary.listRetry")} onPress={onRetryLoad} /> : null}

      <SurfaceCard>
        <View style={styles.reportHeader}>
          <View style={styles.reportIcon}><AppIcon name="reports" size={iconSize.lg} color={colors.orangeDeep} /></View>
          <View style={styles.reportHeading}>
            <Text style={styles.title}>{t(stageContent.titleKey)}</Text>
            <Text style={styles.caption}>{t("reports.rangeLabel")}</Text>
          </View>
        </View>
        <Text style={styles.summary}>{hasDisplayedRecords ? buildReportSummaryCopy(displayedSummary) : t("reports.emptyCopy")}</Text>
        <View style={styles.notice}>
          <AppIcon name="shield" size={iconSize.sm} color={colors.orangeDeep} />
          <Text style={styles.noticeText}>{t("briefing.disclaimer")}</Text>
        </View>
        {hasDisplayedRecords ? (
          <View style={styles.previewBlock}>
            <Text style={styles.blockLabel}>{t("reports.englishPreview")}</Text>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        ) : null}
      </SurfaceCard>

      {hasDisplayedRecords ? (
        <>
          <ReportListSection icon="time" title={t("reports.timelineHighlights")} items={(artifactSnapshot?.timelineItems ?? reportSummary.timelineHighlights).map((item) => formatReportTimelineItem(item, language, formatDiarySummary))} />
          {!artifactSnapshot ? <ReportListSection icon="shield" title={t("reports.missingRecords")} items={reportSummary.missingRecords.length > 0 ? reportSummary.missingRecords.map(formatReportMissingRecord) : [t("reports.noMissingRecords")]} /> : null}
          {!artifactSnapshot ? <ReportListSection icon="condition" title={t("reports.vetQuestions")} items={reportSummary.vetQuestions.map(formatReportVetQuestion)} /> : null}
          <ReportMetricsCard summary={displayedSummary} conditionTrend={conditionTrend} petDetails={artifactSnapshot?.petDetails} />
          <SurfaceCard>
            <Text style={styles.title}>{t("reports.beforeSharing")}</Text>
            <CheckRow copyKey="reports.confirmMedication" />
            <CheckRow copyKey="reports.reviewNotes" />
          </SurfaceCard>
          {report && report.confirmedByOwner && report.status !== "draft" && report.shareUrl && report.expiresAt ? <ReportShareCard shareUrl={report.shareUrl} expiresAt={report.expiresAt} /> : null}
        </>
      ) : reportSummary.sourceStatus === "error" ? (
        <SurfaceCard>
          <Text style={styles.title}>{t("reports.emptyTitle")}</Text>
          <NoticeBanner text={t("reports.loadFailed")} tone="error" icon="close" />
          {reportSummary.refetchSources ? <SecondaryButton label={t("diary.listRetry")} onPress={reportSummary.refetchSources} /> : null}
        </SurfaceCard>
      ) : (
        <SurfaceCard>
          <Text style={styles.title}>{t("reports.emptyTitle")}</Text>
          <Text style={styles.emptyText}>{t(reportSummary.sourceStatus === "loading" ? "diary.listLoading" : "reports.emptyState")}</Text>
        </SurfaceCard>
      )}

      <View style={styles.actions}>
        {pendingAction ? <NoticeBanner text={t(pendingLabelKey[pendingAction])} icon={actionIcon[pendingAction]} tone="progress" /> : null}
        {!pendingAction && !primaryAction && isBusy ? <NoticeBanner text={t("reports.loading")} icon="time" tone="progress" /> : null}
        {!pendingAction && primaryAction ? <PrimaryButton label={t(primaryLabelKey(primaryAction, report?.status))} icon={actionIcon[primaryAction]} onPress={runPrimaryAction} /> : null}
        {report?.status === "shared" && canShare && !isBusy ? (
          <SecondaryButton
            label={t("reports.revokeLink")}
            icon="close"
            onPress={() => void confirmDestructiveAction({
              title: t("reports.revokeTitle"),
              message: t("reports.revokeCopy"),
              cancelText: t("reports.revokeCancel"),
              confirmText: t("reports.revokeConfirm"),
            }, async () => { await onRevoke(); return true; })}
          />
        ) : null}
        {report && !isBusy ? <SecondaryButton label={t("reports.newReport")} icon="report" onPress={onReset} /> : null}
        <SecondaryButton label={t("reports.addMoreRecords")} icon="diary" onPress={onNewDiary} />
      </View>
    </View>
  );
}

function CheckRow({ copyKey }: { copyKey: "reports.confirmMedication" | "reports.reviewNotes" }) {
  return (
    <View style={styles.checkRow}>
      <AppIcon name="check" size={iconSize.sm} color={colors.mintDeep} />
      <Text style={styles.body}>{t(copyKey)}</Text>
    </View>
  );
}

function buildReportSummaryCopy(summary: Pick<ReportDraftSummary, "diaryCount" | "medicationCount" | "medicationAttentionCount">) {
  return t("reports.realSummary").replace("{diaryCount}", `${summary.diaryCount}`).replace("{medicationCount}", `${summary.medicationCount}`).replace("{attentionCount}", `${summary.medicationAttentionCount}`);
}

function conditionTrendCopy(summary: Pick<ReportDraftSummary, "conditionTrend"> | Pick<ReportArtifactSnapshot, "conditionTrend">) {
  const { latestScore, previousScore, direction } = summary.conditionTrend;
  if (!latestScore) return t("reports.conditionTrend.none");
  const scoreCopy = previousScore ? `${previousScore} -> ${latestScore}` : `${latestScore}/5`;
  return `${scoreCopy} ${t(conditionTrendKey[direction])}`;
}

function primaryLabelKey(action: ReportWorkflowAction, status?: VetReportStatus): TranslationKey {
  if (action === "generate") return "reports.generatePreview";
  if (action === "confirm") return "reports.confirmDraft";
  return status === "shared" ? "reports.shareAgain" : "reports.shareNow";
}

const conditionTrendKey: Record<ReportDraftSummary["conditionTrend"]["direction"], TranslationKey> = {
  none: "reports.conditionTrend.none", stable: "reports.conditionTrend.stable", improving: "reports.conditionTrend.improving", declining: "reports.conditionTrend.declining",
};
const actionIcon: Record<ReportWorkflowAction, AppIconName> = { generate: "report", confirm: "check", share: "share", revoke: "close" };
const pendingLabelKey: Record<ReportWorkflowAction, TranslationKey> = { generate: "reports.generateInProgress", confirm: "reports.confirmInProgress", share: "reports.shareInProgress", revoke: "reports.revokeInProgress" };
const workflowErrorKey: Record<ReportWorkflowError, TranslationKey> = {
  accountRequired: "reports.accountRequired", petRequired: "reports.petRequired", empty: "reports.emptyState", permission: "permission.reportCareTeamOnly", load: "reports.loadFailed", generate: "reports.generateFailed", confirm: "reports.confirmFailed", share: "reports.shareFailed", revoke: "reports.revokeFailed",
};
const stageCopy: Record<"empty" | VetReportStatus, { titleKey: TranslationKey; noticeKey: TranslationKey }> = {
  empty: { titleKey: "reports.previewTitle", noticeKey: "reports.previewNotice" },
  draft: { titleKey: "reports.draftTitle", noticeKey: "reports.draftNotice" },
  confirmed: { titleKey: "reports.confirmedTitle", noticeKey: "reports.confirmedNotice" },
  shared: { titleKey: "reports.sharedTitle", noticeKey: "reports.sharedNotice" },
};

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  reportHeader: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  reportIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfacePeach, alignItems: "center", justifyContent: "center" },
  reportHeading: { flex: 1 },
  title: { ...type.sectionTitle },
  caption: { ...type.caption, marginTop: spacing.xs },
  summary: { ...type.body, marginTop: spacing.lg },
  notice: { marginTop: spacing.lg, borderRadius: radius.sm, backgroundColor: colors.summaryBg, padding: spacing.md, flexDirection: "row", gap: spacing.sm },
  noticeText: { ...type.caption, flex: 1, color: colors.diagnosis },
  previewBlock: { marginTop: spacing.lg, gap: spacing.xs },
  blockLabel: { ...type.caption, color: colors.orangeDeep, fontWeight: font.weight.bold },
  previewText: { ...type.body, color: colors.text },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  body: { ...type.body, flex: 1 },
  actions: { gap: spacing.md },
  emptyText: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
});
