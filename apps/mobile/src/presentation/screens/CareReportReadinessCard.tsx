import { StyleSheet, Text, View } from "react-native";
import type { ActiveCareSetup } from "../../contexts/care/domain/carePlan";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export function VetReportReadinessCard({
  doses,
  conditionScore,
  careSetup,
}: {
  doses: DoseRecord[];
  conditionScore?: number;
  careSetup: ActiveCareSetup;
}) {
  const items = [
    {
      label: t("ko", "care.readinessCarePlan"),
      ready: Boolean(careSetup.condition || careSetup.plan || careSetup.conditionName || careSetup.planTitle || careSetup.schedules.length > 0),
    },
    { label: t("ko", "care.readinessMedication"), ready: doses.length > 0 },
    { label: t("ko", "care.readinessCondition"), ready: Boolean(conditionScore) },
  ];
  const readyCount = items.filter((item) => item.ready).length;

  return (
    <SurfaceCard>
      <View style={styles.header}>
        <View style={styles.body}>
          <Text style={styles.title}>{t("ko", "care.readinessTitle")}</Text>
          <Text style={styles.copy}>{t("ko", "care.readinessCopy")}</Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreText}>{readyCount}/3</Text>
        </View>
      </View>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.label} style={styles.row}>
            <AppIcon name={item.ready ? "check" : "circle"} size={iconSize.sm} color={item.ready ? colors.mintDeep : colors.textSoft} />
            <Text style={styles.label}>{item.label}</Text>
            <Text style={[styles.status, item.ready && styles.statusReady]}>{t("ko", item.ready ? "care.readinessReady" : "care.readinessMissing")}</Text>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  body: {
    flex: 1,
  },
  title: {
    ...type.sectionTitle,
  },
  copy: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  score: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surfacePeach,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    ...type.bodyStrong,
    color: colors.orangeDeep,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  row: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    ...type.body,
    flex: 1,
  },
  status: {
    ...type.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  statusReady: {
    color: colors.mintDeep,
  },
});
