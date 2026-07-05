import { StyleSheet, Text, View } from "react-native";
import type { ReportDraftSummary } from "../../contexts/report/application/reportDraftRecords";
import { SurfaceCard } from "../../design-system/components";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export function ReportListSection({ icon, title, items }: { icon: AppIconName; title: string; items: string[] }) {
  return (
    <SurfaceCard>
      <View style={styles.sectionTitleRow}>
        <AppIcon name={icon} size={iconSize.sm} color={colors.orangeDeep} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.listRow}>
            <View style={styles.listDot} />
            <Text style={styles.body}>{item}</Text>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

export function ReportMetricsCard({ summary, conditionTrend }: { summary: ReportDraftSummary; conditionTrend: string }) {
  return (
    <SurfaceCard>
      <Text style={styles.title}>{t("ko", "reports.recordCounts")}</Text>
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

export function MockShareCard() {
  return (
    <SurfaceCard>
      <View style={styles.sectionTitleRow}>
        <AppIcon name="share" size={iconSize.sm} color={colors.orangeDeep} />
        <Text style={styles.title}>{t("ko", "reports.mockShareTitle")}</Text>
      </View>
      <Text style={styles.body}>{t("ko", "reports.mockShareCopy")}</Text>
      <Text style={styles.mockUrl}>{t("ko", "reports.mockShareUrl")}</Text>
      <Text style={styles.shareCaption}>{t("ko", "reports.mockShareExpiry")}</Text>
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
  mockUrl: {
    ...type.bodyStrong,
    color: colors.diagnosis,
    marginTop: spacing.md,
  },
  shareCaption: {
    ...type.caption,
    marginTop: spacing.sm,
  },
});
