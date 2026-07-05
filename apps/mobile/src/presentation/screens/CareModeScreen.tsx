import { useMemo, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActiveCareSetup } from "../../contexts/care/domain/carePlan";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { PrimaryButton, SecondaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { SummaryCard } from "../ui/SummaryCard";
import { MedicationRow, QuickMedicationForm, type QuickMedicationSaveHandler } from "./CareMedicationPanel";
import type { TodayMedicationAgendaRow } from "./todayMedicationAgenda";

type Segment = "care" | "reports";
type QuickMedicationUpdateHandler = NonNullable<ComponentProps<typeof QuickMedicationForm>["onUpdate"]>;

export function CareModeScreen({
  doses,
  medicationAgenda = [],
  onAgendaStatusChange,
  onAddDose,
  onUpdateDose,
  onDeleteDose,
  onGenerateReport,
  conditionScore,
  careSetup,
}: {
  doses: DoseRecord[];
  medicationAgenda?: TodayMedicationAgendaRow[];
  onAgendaStatusChange?: (row: TodayMedicationAgendaRow, status: "completed" | "skipped" | "partial") => void;
  onAddDose: QuickMedicationSaveHandler;
  onUpdateDose: (input: Parameters<QuickMedicationUpdateHandler>[0]) => void | Promise<void>;
  onDeleteDose: (dose: DoseRecord) => void | Promise<boolean | void>;
  onGenerateReport: () => void;
  conditionScore?: number;
  careSetup: ActiveCareSetup;
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
          medicationAgenda={medicationAgenda}
          onAgendaStatusChange={onAgendaStatusChange}
          onAddDose={onAddDose}
          onUpdateDose={onUpdateDose}
          onDeleteDose={onDeleteDose}
          onGenerateReport={onGenerateReport}
          conditionScore={conditionScore}
          careSetup={careSetup}
        />
      ) : (
        <ReportPanel onShare={onGenerateReport} />
      )}
    </View>
  );
}

function CarePanel({
  doses,
  medicationAgenda,
  onAgendaStatusChange,
  onAddDose,
  onUpdateDose,
  onDeleteDose,
  onGenerateReport,
  conditionScore,
  careSetup,
}: {
  doses: DoseRecord[];
  medicationAgenda: TodayMedicationAgendaRow[];
  onAgendaStatusChange?: (row: TodayMedicationAgendaRow, status: "completed" | "skipped" | "partial") => void;
  onAddDose: QuickMedicationSaveHandler;
  onUpdateDose: (input: Parameters<QuickMedicationUpdateHandler>[0]) => void | Promise<void>;
  onDeleteDose: (dose: DoseRecord) => void | Promise<boolean | void>;
  onGenerateReport: () => void;
  conditionScore?: number;
  careSetup: ActiveCareSetup;
}) {
  const [editingDoseId, setEditingDoseId] = useState<string | null>(null);
  const [temporaryFormOpen, setTemporaryFormOpen] = useState(false);
  const editingDose = useMemo(() => doses.find((dose) => dose.id === editingDoseId) ?? null, [doses, editingDoseId]);
  const agendaRows = medicationAgenda.length > 0 ? medicationAgenda : doses.map((dose) => ({ source: "dose" as const, doseId: dose.id, scheduleId: dose.scheduleId, doseDate: dose.doseDate ?? "", medicationName: dose.medicationName, conditionName: dose.conditionName, dosageLabel: dose.dosageLabel, scheduledTime: dose.scheduledAt, status: dose.status }));
  const pendingCount = agendaRows.filter((row) => row.status === "pending").length;

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ko", "care.todayMedicationTitle")}</Text>
        <Text style={styles.linkText}>{t("ko", "care.todayMedicationProgress")} {pendingCount}</Text>
      </View>
      <View style={styles.medList}>
        {agendaRows.length === 0 ? <Text style={styles.emptyText}>{t("ko", "care.noMedicationToday")}</Text> : null}
        {agendaRows.map((row) => (
          <MedicationAgendaRow key={`${row.scheduleId ?? row.doseId}-${row.doseDate}-${row.scheduledTime}`} row={row} onEdit={row.doseId ? () => setEditingDoseId(row.doseId ?? null) : undefined} onStatusChange={(status) => onAgendaStatusChange?.(row, status)} />
        ))}
      </View>

      <SecondaryButton label={t("ko", "care.temporaryAdd")} icon="add" onPress={() => setTemporaryFormOpen((current) => !current)} />
      {temporaryFormOpen || editingDose ? <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} /> : null}

      <SurfaceCard>
        <Text style={styles.sectionTitle}>{t("ko", "care.scheduleSummaryTitle")}</Text>
        <Text style={styles.reportCopy}>{t("ko", "care.scheduleSummaryCopy")}</Text>
        {careSetup.schedules.slice(0, 3).map((schedule) => (
          <Text key={schedule.id} style={styles.emptyText}>{schedule.localTime.slice(0, 5)} · {schedule.medicationName}</Text>
        ))}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>{t("ko", "care.conditionFromDiaryTitle")}</Text>
        <Text style={styles.reportCopy}>{conditionScore ? `${t("ko", "care.latestCondition")} ${conditionScore}/5` : t("ko", "care.conditionFromDiaryCopy")}</Text>
      </SurfaceCard>
      <PrimaryButton label={t("ko", "care.generateVetReport")} icon="report" onPress={onGenerateReport} />
    </>
  );
}

function MedicationAgendaRow({ row, onEdit, onStatusChange }: { row: TodayMedicationAgendaRow; onEdit?: () => void; onStatusChange: (status: "completed" | "skipped") => void }) {
  const visual = row.status === "completed" ? { accent: colors.mint, icon: colors.mintDeep, label: t("ko", "care.status.completed") } : row.status === "skipped" ? { accent: colors.inactive, icon: colors.textSoft, label: t("ko", "care.status.skipped") } : row.status === "partial" ? { accent: colors.memo, icon: colors.orangeDeep, label: t("ko", "care.status.partial") } : { accent: colors.salmon, icon: colors.salmon, label: t("ko", "care.status.pending") };

  return (
    <View style={styles.agendaRow}>
      <View style={[styles.medAccent, { backgroundColor: visual.accent }]} />
      <AppIcon name="medication" size={iconSize.lg} color={visual.icon} />
      <View style={styles.agendaBody}>
        <Text style={styles.medTitle}>{row.medicationName}</Text>
        <Text style={styles.medDetail}>{row.scheduledTime} · {visual.label}</Text>
        {row.conditionName ? <Text style={styles.medMeta}>{t("ko", "care.conditionLabel")}: {row.conditionName}</Text> : null}
        {row.dosageLabel ? <Text style={styles.medMeta}>{t("ko", "care.dosageLabel")}: {row.dosageLabel}</Text> : null}
        <View style={styles.actionButtons}>
          <Pressable style={styles.givenButton} onPress={() => onStatusChange("completed")}>
            <Text style={styles.givenButtonText}>{t("ko", "care.status.given")}</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={() => onStatusChange("skipped")}>
            <Text style={styles.skipButtonText}>{t("ko", "care.status.notGiven")}</Text>
          </Pressable>
        </View>
      </View>
      {onEdit ? (
        <Pressable onPress={onEdit} style={styles.editButton}>
          <Text style={styles.linkText}>{t("ko", "care.quickDoseUpdate")}</Text>
        </Pressable>
      ) : null}
    </View>
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
  agendaRow: {
    minHeight: 112,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    gap: spacing.md,
  },
  medAccent: { width: 8, height: "100%" },
  agendaBody: { flex: 1, gap: spacing.xs, paddingVertical: spacing.md },
  medTitle: { ...type.bodyStrong },
  medDetail: { ...type.caption },
  medMeta: { ...type.tiny, color: colors.textMuted },
  actionButtons: { gap: spacing.sm, marginTop: spacing.sm },
  givenButton: { minHeight: 40, borderRadius: radius.md, backgroundColor: colors.mintDeep, alignItems: "center", justifyContent: "center" },
  givenButtonText: { ...type.bodyStrong, color: colors.white },
  skipButton: { minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  skipButtonText: { ...type.bodyStrong, color: colors.textMuted },
  editButton: { paddingRight: spacing.md },
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
