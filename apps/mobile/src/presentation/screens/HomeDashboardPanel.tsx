import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { DashboardSummary } from "../shell/todayChecklist";
import { createCareSummaryDoseRows } from "./HomeDashboardPanel.logic";

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
  const [expanded, setExpanded] = useState(false);
  const completedDoses = doses.filter((dose) => dose.status !== "pending").length;
  const pendingCopy = dashboard.pendingMedicationCount > 0 ? `${t("ko", "today.dashboardMedicationPending")} ${dashboard.pendingMedicationCount}` : t("ko", "today.dashboardMedicationClear");
  const rows = createCareSummaryDoseRows(doses);

  return (
    <SurfaceCard>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t("ko", "today.dashboardCare")}
        style={({ pressed }) => [styles.careSummary, pressed && styles.pressed]}
        onPress={() => setExpanded((current) => !current)}
      >
        <View style={styles.careIcon}>
          <AppIcon name="medication" size={iconSize.md} color={colors.salmon} />
        </View>
        <View style={styles.careBody}>
          <Text style={styles.careTitle}>{t("ko", "today.dashboardCare")}</Text>
          <Text style={styles.careCopy}>{pendingCopy}</Text>
        </View>
        <Text style={styles.careCount}>{completedDoses}/{doses.length}</Text>
        <View style={[styles.chevron, expanded && styles.chevronOpen]}>
          <AppIcon name="chevronDown" size={iconSize.sm} color={colors.textSoft} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.savedList}>
          <Text style={styles.savedTitle}>{t("ko", "today.careSummarySavedTitle")}</Text>
          {rows.length === 0 ? <Text style={styles.emptyText}>{t("ko", "today.careSummaryEmpty")}</Text> : null}
          {rows.map((row) => (
            <View key={row.id} style={styles.savedRow}>
              <View style={styles.savedRowTop}>
                <Text style={styles.savedMedication}>{row.title}</Text>
                <Text style={styles.savedStatus}>{row.statusLabel}</Text>
              </View>
              <Text style={styles.savedTime}>{row.timeLabel}</Text>
              {row.details.map((detail) => <Text key={detail} style={styles.savedDetail}>{detail}</Text>)}
            </View>
          ))}
        </View>
      ) : null}
    </SurfaceCard>
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
  pressed: { opacity: 0.72 },
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
  chevron: { width: 20, alignItems: "center", justifyContent: "center" },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  savedList: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  savedTitle: { ...type.caption, color: colors.textMuted },
  emptyText: { ...type.caption, color: colors.textMuted },
  savedRow: { borderRadius: radius.sm, backgroundColor: colors.surfaceWarm, padding: spacing.md, gap: spacing.xxs },
  savedRowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  savedMedication: { ...type.bodyStrong, flex: 1 },
  savedStatus: { ...type.tiny, color: colors.orangeDeep },
  savedTime: { ...type.caption, color: colors.textMuted },
  savedDetail: { ...type.caption, color: colors.text },
});
