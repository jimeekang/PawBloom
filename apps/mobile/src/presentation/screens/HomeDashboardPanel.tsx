import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { SurfaceCard } from "../../design-system/components";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { DashboardSummary } from "../liveUiState";

type Props = {
  dashboard: DashboardSummary;
  doses: DoseRecord[];
};

export function AttentionStrip({ signals }: { signals: string[] }) {
  return (
    <View style={styles.attentionStrip}>
      <AppIcon name={signals.length > 0 ? "shield" : "check"} size={iconSize.sm} color={signals.length > 0 ? colors.coral : colors.mintDeep} />
      <View style={styles.attentionBody}>
        <Text style={styles.attentionTitle}>{t("ko", "today.dashboardAttention")}</Text>
        <Text style={styles.attentionCopy}>{signals.length > 0 ? signals.join(" ") : t("ko", "today.dashboardNoAttention")}</Text>
      </View>
    </View>
  );
}

export function CareSummaryCard({ dashboard, doses }: Props) {
  const completedDoses = doses.filter((dose) => dose.status !== "pending").length;
  const pendingCopy = dashboard.pendingMedicationCount > 0 ? `${t("ko", "today.dashboardMedicationPending")} ${dashboard.pendingMedicationCount}` : t("ko", "today.dashboardMedicationClear");

  return (
    <SurfaceCard>
      <View style={styles.careSummary}>
        <View style={styles.careIcon}>
          <AppIcon name="medication" size={iconSize.md} color={colors.salmon} />
        </View>
        <View style={styles.careBody}>
          <Text style={styles.careTitle}>{t("ko", "today.dashboardCare")}</Text>
          <Text style={styles.careCopy}>{pendingCopy}</Text>
        </View>
        <Text style={styles.careCount}>{completedDoses}/{doses.length}</Text>
      </View>
    </SurfaceCard>
  );
}

export function QuickActionRow({ onAddDiary, onRecordMedication, onViewReport }: { onAddDiary: () => void; onRecordMedication: () => void; onViewReport: () => void }) {
  return (
    <View style={styles.quickActions}>
      <QuickAction label={t("ko", "today.dashboardAddDiary")} icon="add" onPress={onAddDiary} />
      <QuickAction label={t("ko", "today.dashboardRecordMedication")} icon="medication" onPress={onRecordMedication} />
      <QuickAction label={t("ko", "today.dashboardViewReport")} icon="report" onPress={onViewReport} />
    </View>
  );
}

function QuickAction({ label, icon, onPress }: { label: string; icon: AppIconName; onPress: () => void }) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <AppIcon name={icon} size={iconSize.sm} color={colors.orangeDeep} />
      <Text style={styles.quickActionText} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  attentionStrip: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  attentionBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  attentionTitle: {
    ...type.bodyStrong,
  },
  attentionCopy: {
    ...type.caption,
  },
  careSummary: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  careIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surfacePeach,
    alignItems: "center",
    justifyContent: "center",
  },
  careBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  careTitle: {
    ...type.bodyStrong,
  },
  careCopy: {
    ...type.caption,
  },
  careCount: {
    ...type.sectionTitle,
    color: colors.orangeDeep,
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  quickActionText: {
    ...type.tiny,
    color: colors.text,
    textAlign: "center",
  },
});
