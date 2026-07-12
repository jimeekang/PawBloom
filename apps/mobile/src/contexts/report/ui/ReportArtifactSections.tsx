import { StyleSheet, Text, View } from "react-native";
import type { ReportDraftSummary } from "../application/reportDraftRecords";
import { SurfaceCard } from "../../../design-system/components";
import { AppIcon, type AppIconName } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { formatReportExpiry } from "./reportWorkflow";

type ReportMetricSummary = Pick<
  ReportDraftSummary,
  "diaryCount" | "medicationCompletedCount" | "medicationPendingCount" | "medicationAttentionCount"
>;

export function ReportListSection({ icon, title, items }: { icon: AppIconName; title: string; items: string[] }) {
  return (
    <SurfaceCard>
      <View style={styles.sectionTitleRow}>
        <AppIcon name={icon} size={iconSize.sm} color={colors.orangeDeep} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={`${index}:${item}`} style={styles.listRow}>
            <View style={styles.listDot} />
            <Text style={styles.body}>{item}</Text>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

export function ReportMetricsCard({ summary, conditionTrend, petDetails }: { summary: ReportMetricSummary; conditionTrend: string; petDetails?: string }) {
  return (
    <SurfaceCard>
      <Text style={styles.title}>{t("ko", "reports.recordCounts")}</Text>
      {petDetails ? <Text selectable style={styles.petDetails}>{petDetails}</Text> : null}
      <MetricRow icon="diary" label={t("ko", "reports.diaryCount")} value={`${summary.diaryCount}`} />
      <MetricRow icon="condition" label={t("ko", "reports.conditionTrend")} value={conditionTrend} />
      <MetricRow
        icon="medication"
        label={t("ko", "reports.medicationAdherence")}
        value={t("ko", "reports.medicationAdherenceValue")
          .replace("{completed}", `${summary.medicationCompletedCount}`)
          .replace("{pending}", `${summary.medicationPendingCount}`)
          .replace("{attention}", `${summary.medicationAttentionCount}`)}
      />
    </SurfaceCard>
  );
}

export function ReportShareCard({ shareUrl, expiresAt }: { shareUrl: string; expiresAt: string }) {
  return (
    <SurfaceCard>
      <View style={styles.sectionTitleRow}>
        <AppIcon name="share" size={iconSize.sm} color={colors.orangeDeep} />
        <Text style={styles.title}>{t("ko", "reports.actualShareTitle")}</Text>
      </View>
      <Text style={styles.body}>{t("ko", "reports.actualShareCopy")}</Text>
      <Text style={styles.shareLabel}>{t("ko", "reports.shareUrlLabel")}</Text>
      <Text selectable style={styles.shareUrl}>{shareUrl}</Text>
      <Text style={styles.shareCaption}>{t("ko", "reports.actualShareExpiry").replace("{expiry}", formatReportExpiry(expiresAt))}</Text>
      <Text style={styles.shareCaption}>{t("ko", "reports.selectableLink")}</Text>
    </SurfaceCard>
  );
}

function MetricRow({ icon, label, value }: { icon: AppIconName; label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <AppIcon name={icon} size={iconSize.sm} color={colors.orangeDeep} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.sectionTitle,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  listRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.orangeDeep,
    marginTop: 8,
  },
  body: {
    ...type.body,
    flex: 1,
  },
  petDetails: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  metricRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricLabel: {
    ...type.body,
    flex: 1,
  },
  metricValue: {
    ...type.bodyStrong,
    color: colors.diagnosis,
    textAlign: "right",
    maxWidth: "48%",
  },
  shareLabel: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  shareUrl: {
    ...type.bodyStrong,
    color: colors.diagnosis,
    marginTop: spacing.xs,
  },
  shareCaption: {
    ...type.caption,
    marginTop: spacing.sm,
  },
});
