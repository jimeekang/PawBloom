import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";
import { NoticeBanner, OutlineIconButton, PrimaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { SummaryCard } from "../ui/SummaryCard";
import type { DraftDiaryEntry } from "../mockUiState";
import { CareRecordPanel } from "./CareRecordPanel";

type Segment = "care" | "reports";

export function CareModeScreen({
  doses,
  onDosePress,
  onAddDose,
  onSaveCareEntry,
  onGenerateReport,
  conditionScore,
}: {
  doses: DoseRecord[];
  onDosePress: (id: string) => void;
  onAddDose: () => void;
  onSaveCareEntry: (entry: DraftDiaryEntry) => void;
  onGenerateReport: () => void;
  conditionScore?: number;
}) {
  const [segment, setSegment] = useState<Segment>("care");

  return (
    <View style={styles.screen}>
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        items={[
          { label: t("ko", "care.segment.care"), value: "care" },
          { label: t("ko", "care.segment.reports"), value: "reports" },
        ]}
      />

      {segment === "care" ? (
        <CarePanel
          doses={doses}
          onDosePress={onDosePress}
          onAddDose={onAddDose}
          onSaveCareEntry={onSaveCareEntry}
          onGenerateReport={onGenerateReport}
          conditionScore={conditionScore}
        />
      ) : (
        <ReportPanel onShare={onGenerateReport} />
      )}
    </View>
  );
}

function CarePanel({
  doses,
  onDosePress,
  onAddDose,
  onSaveCareEntry,
  onGenerateReport,
  conditionScore,
}: {
  doses: DoseRecord[];
  onDosePress: (id: string) => void;
  onAddDose: () => void;
  onSaveCareEntry: (entry: DraftDiaryEntry) => void;
  onGenerateReport: () => void;
  conditionScore?: number;
}) {
  return (
    <>
      <NoticeBanner text={t("ko", "care.tapMedication")} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ko", "care.medicationToday")}</Text>
        <OutlineIconButton icon="add" onPress={onAddDose} />
      </View>
      <View style={styles.medList}>
        {doses.length === 0 ? <Text style={styles.emptyText}>{t("ko", "care.noMedicationToday")}</Text> : null}
        {doses.map((dose) => (
          <MedicationRow key={dose.id} dose={dose} onPress={() => onDosePress(dose.id)} />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ko", "care.conditionScore")}</Text>
        <Text style={styles.linkText}>{t("ko", "care.seeHistory")}</Text>
      </View>
      <SurfaceCard>
        {conditionScore ? (
          <ScoreRow label={t("ko", "care.latestCondition")} color={colors.salmon} value={conditionScore} />
        ) : (
          <Text style={styles.emptyText}>{t("ko", "care.noConditionScore")}</Text>
        )}
      </SurfaceCard>

      <CareRecordPanel onSave={onSaveCareEntry} />
      <SummaryCard />
      <PrimaryButton label={t("ko", "care.generateVetReport")} icon="report" onPress={onGenerateReport} />
    </>
  );
}

function ReportPanel({ onShare }: { onShare: () => void }) {
  return (
    <>
      <SummaryCard />
      <SurfaceCard>
        <Text style={styles.sectionTitle}>{t("ko", "care.readyForVetReview")}</Text>
        <Text style={styles.reportCopy}>{t("ko", "care.readyCopy")}</Text>
      </SurfaceCard>
      <PrimaryButton label={t("ko", "care.shareReportLink")} icon="reports" onPress={onShare} />
    </>
  );
}

function MedicationRow({ dose, onPress }: { dose: DoseRecord; onPress: () => void }) {
  const visual = statusVisual[dose.status];

  return (
    <Pressable style={styles.medRow} onPress={onPress}>
      <View style={[styles.medAccent, { backgroundColor: visual.accent }]} />
      <AppIcon name="medication" size={iconSize.lg} color={visual.icon} />
      <View style={styles.medBody}>
        <Text style={styles.medTitle}>{dose.medicationName}</Text>
        <Text style={styles.medDetail}>{visual.label}</Text>
      </View>
      <Text style={styles.medTime}>{dose.scheduledAt}</Text>
      <View style={[styles.doneCircle, dose.status === "completed" && styles.doneCircleActive]}>
        {dose.status === "completed" ? (
          <AppIcon name="check" size={iconSize.sm} color={colors.white} />
        ) : (
          <AppIcon name="circle" size={iconSize.sm} color={visual.icon} />
        )}
      </View>
    </Pressable>
  );
}

function ScoreRow({ label, color, value }: { label: string; color: string; value: number }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.paws}>
        {[1, 2, 3, 4, 5].map((score) => (
          <AppIcon key={score} name="walk" size={iconSize.md} color={score <= value ? color : colors.inactive} />
        ))}
      </View>
      <Text style={styles.scoreValue}>{value}/5</Text>
    </View>
  );
}

const statusVisual: Record<DoseStatus, { label: string; accent: string; icon: string }> = {
  pending: { label: t("ko", "care.status.pending"), accent: colors.salmon, icon: colors.salmon },
  completed: { label: t("ko", "care.status.completed"), accent: colors.mint, icon: colors.mintDeep },
  partial: { label: t("ko", "care.status.partial"), accent: colors.memo, icon: colors.orangeDeep },
  skipped: { label: t("ko", "care.status.skipped"), accent: colors.inactive, icon: colors.textSoft },
};

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  linkText: {
    ...type.caption,
    color: colors.orangeDeep,
  },
  medList: {
    gap: spacing.md,
  },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
  },
  medRow: {
    minHeight: 70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing.md,
    overflow: "hidden",
    gap: spacing.md,
  },
  medAccent: {
    width: 8,
    height: "100%",
  },
  medBody: {
    flex: 1,
  },
  medTitle: {
    ...type.bodyStrong,
  },
  medDetail: {
    ...type.caption,
  },
  medTime: {
    ...type.body,
    color: colors.textMuted,
  },
  doneCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.inactive,
    alignItems: "center",
    justifyContent: "center",
  },
  doneCircleActive: {
    backgroundColor: colors.mintDeep,
    borderColor: colors.mintDeep,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
  },
  scoreLabel: {
    ...type.body,
    flex: 1,
  },
  paws: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  scoreValue: {
    ...type.body,
    width: 40,
    textAlign: "right",
  },
  reportCopy: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
