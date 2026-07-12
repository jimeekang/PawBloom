import { StyleSheet, Text } from "react-native";
import { NoticeBanner, PrimaryButton, SurfaceCard } from "../../design-system/components";
import { SummaryCard } from "../../design-system/SummaryCard";
import { colors, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export function CareReportPanel({ onOpenReports, canManageReports }: { onOpenReports: () => void; canManageReports: boolean }) {
  return (
    <>
      <SummaryCard />
      <SurfaceCard>
        <Text style={styles.title}>{t("ko", "care.readyForVetReview")}</Text>
        <Text style={styles.copy}>{t("ko", "care.readyCopy")}</Text>
      </SurfaceCard>
      {canManageReports
        ? <PrimaryButton label={t("ko", "care.shareReportLink")} icon="reports" onPress={onOpenReports} />
        : <NoticeBanner text={t("ko", "permission.reportCareTeamOnly")} icon="shield" />}
    </>
  );
}

const styles = StyleSheet.create({
  title: { ...type.sectionTitle },
  copy: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
});
