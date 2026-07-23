import { StyleSheet, Text, View } from "react-native";
import { SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import type { Entitlement } from "../domain/entitlement";

export function SubscriptionPlanCard({
  entitlement,
  ownedPetCount,
  loading,
  failed,
}: {
  entitlement: Entitlement | null;
  ownedPetCount: number;
  loading: boolean;
  failed: boolean;
}) {
  const planLabel = entitlement ? t("ko", `settings.plan.${entitlement.plan}` as const) : null;
  const statusLabel = loading
    ? t("ko", "settings.planLoading")
    : failed || !planLabel
      ? t("ko", "settings.planLoadFailed")
      : planLabel;
  return (
    <SurfaceCard>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppIcon name="lock" size={iconSize.md} color={colors.orangeDeep} />
          <View style={styles.titleCopy}>
            <Text style={styles.title}>{t("ko", "settings.planTitle")}</Text>
            <Text style={[styles.plan, failed && styles.planError]}>{statusLabel}</Text>
          </View>
        </View>
        {entitlement ? (
          <>
            <PlanLine text={t("ko", "settings.planPets").replace("{count}", `${ownedPetCount}`).replace("{limit}", `${entitlement.maxPets}`)} enabled={ownedPetCount <= entitlement.maxPets} />
            <PlanLine text={t("ko", entitlement.familySharingEnabled ? "settings.planFamilyEnabled" : "settings.planFamilyLocked")} enabled={entitlement.familySharingEnabled} />
            <PlanLine text={t("ko", "settings.planReports")} enabled={entitlement.reportSharingEnabled} />
            <PlanLine text={t("ko", "settings.planPhotos").replace("{count}", `${entitlement.dailyPhotoLimit}`)} enabled />
          </>
        ) : null}
        <Text style={styles.note}>{t("ko", "settings.planBetaNote")}</Text>
      </View>
    </SurfaceCard>
  );
}

function PlanLine({ text, enabled }: { text: string; enabled: boolean }) {
  return (
    <View style={styles.line}>
      <AppIcon name={enabled ? "check" : "lock"} size={iconSize.sm} color={enabled ? colors.mintDeep : colors.textMuted} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  titleCopy: { flex: 1 },
  title: { ...type.sectionTitle },
  plan: { ...type.caption, color: colors.orangeDeep, marginTop: spacing.xxs },
  planError: { color: colors.danger },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lineText: { ...type.body, color: colors.text, flex: 1 },
  note: { ...type.caption, color: colors.textMuted },
});
