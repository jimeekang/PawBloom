import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../../contexts/care/domain/carePlan";
import type { QuickMedicationDoseInput } from "../../contexts/medication/application/medicationDoseRecords";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { NoticeBanner, PrimaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { SummaryCard } from "../ui/SummaryCard";
import type { DraftDiaryEntry } from "../mockUiState";
import { CareRecordPanel } from "./CareRecordPanel";
import { MedicationRow, QuickMedicationForm } from "./CareMedicationPanel";
import { CareSetupPanel } from "./CareSetupPanel";

type Segment = "care" | "reports";

export function CareModeScreen({
  doses,
  onDosePress,
  onAddDose,
  onSaveCareEntry,
  onGenerateReport,
  conditionScore,
  careSetup,
  onSaveCareSetup,
  onUseCareSchedule,
}: {
  doses: DoseRecord[];
  onDosePress: (id: string) => void;
  onAddDose: (input: QuickMedicationDoseInput) => void;
  onSaveCareEntry: (entry: DraftDiaryEntry) => void;
  onGenerateReport: () => void;
  conditionScore?: number;
  careSetup: ActiveCareSetup;
  onSaveCareSetup: (input: CareSetupInput) => void;
  onUseCareSchedule: (schedule: CareMedicationSchedule) => void;
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
          careSetup={careSetup}
          onSaveCareSetup={onSaveCareSetup}
          onUseCareSchedule={onUseCareSchedule}
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
  careSetup,
  onSaveCareSetup,
  onUseCareSchedule,
}: {
  doses: DoseRecord[];
  onDosePress: (id: string) => void;
  onAddDose: (input: QuickMedicationDoseInput) => void;
  onSaveCareEntry: (entry: DraftDiaryEntry) => void;
  onGenerateReport: () => void;
  conditionScore?: number;
  careSetup: ActiveCareSetup;
  onSaveCareSetup: (input: CareSetupInput) => void;
  onUseCareSchedule: (schedule: CareMedicationSchedule) => void;
}) {
  return (
    <>
      <NoticeBanner text={t("ko", "care.tapMedication")} />

      <CareSetupPanel setup={careSetup} onSave={onSaveCareSetup} onUseSchedule={onUseCareSchedule} />
      <QuickMedicationForm onSave={onAddDose} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ko", "care.medicationToday")}</Text>
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
