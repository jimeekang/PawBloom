import { useMemo, useState, type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../../contexts/care/domain/carePlan";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { NoticeBanner, PrimaryButton, SecondaryButton, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { QuickMedicationForm, type QuickMedicationSaveHandler } from "../../contexts/medication/ui/CareMedicationPanel";
import { careStatusActionLabel } from "../../contexts/medication/ui/careMedicationPanelState";
import { medicationAgendaSourceLabelKey, type TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { CareMedicationAddCard } from "./CareMedicationAddCard";
import { VetReportReadinessCard } from "../../contexts/care/ui/CareReportReadinessCard";
import { partitionCareSchedules, schedulePeriodBadge } from "./careScheduleSummary";
import { scheduleAppliesOnDate } from "../../contexts/medication/application/medicationScheduleRules";
import { getLocalDateKey } from "../../shared-kernel/date";
import { styles } from "./CareModeScreen.styles";

type QuickMedicationUpdateHandler = NonNullable<ComponentProps<typeof QuickMedicationForm>["onUpdate"]>;

type CareModeScreenProps = {
  petId: string;
  doses: DoseRecord[];
  medicationAgenda?: TodayMedicationAgendaRow[];
  onAgendaStatusChange?: (row: TodayMedicationAgendaRow, status: "completed" | "skipped" | "partial") => void;
  onAddDose: QuickMedicationSaveHandler;
  onUpdateDose: (input: Parameters<QuickMedicationUpdateHandler>[0]) => void | Promise<void>;
  onDeleteDose: (dose: DoseRecord) => void | Promise<boolean | void>;
  onSaveCareSetup: (input: CareSetupInput) => Promise<ActiveCareSetup>;
  onUseSchedule: (schedule: CareMedicationSchedule) => void;
  onOpenProfileCare: () => void;
  onGenerateReport: () => void;
  conditionScore?: number;
  careSetup: ActiveCareSetup;
  careStatus?: "ready" | "loading" | "error";
  onRetryCare?: () => void;
  canManageCare?: boolean;
  canDeleteDose?: boolean;
  canManageReports?: boolean;
};

export function CareModeScreen({ canManageCare = true, canDeleteDose = true, canManageReports = true, ...props }: CareModeScreenProps) {
  return (
    <View style={styles.screen}>
      <CarePanel {...props} canManageCare={canManageCare} canDeleteDose={canDeleteDose} canManageReports={canManageReports} />
    </View>
  );
}

function CarePanel({
  petId,
  doses,
  medicationAgenda = [],
  onAgendaStatusChange,
  onAddDose,
  onUpdateDose,
  onDeleteDose,
  onSaveCareSetup,
  onUseSchedule,
  onOpenProfileCare,
  onGenerateReport,
  conditionScore,
  careSetup,
  careStatus = "ready",
  onRetryCare,
  canManageCare,
  canDeleteDose,
  canManageReports,
}: Omit<CareModeScreenProps, "canManageCare" | "canDeleteDose" | "canManageReports"> & {
  canManageCare: boolean;
  canDeleteDose: boolean;
  canManageReports: boolean;
}) {
  const [editingDoseId, setEditingDoseId] = useState<string | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [schedulesExpanded, setSchedulesExpanded] = useState(false);
  const editingDose = useMemo(() => doses.find((dose) => dose.id === editingDoseId) ?? null, [doses, editingDoseId]);
  const agendaRows = medicationAgenda.length > 0 ? medicationAgenda : doses.map((dose) => ({ source: "dose" as const, doseId: dose.id, scheduleId: dose.scheduleId, doseDate: dose.doseDate ?? "", medicationName: dose.medicationName, conditionName: dose.conditionName, dosageLabel: dose.dosageLabel, scheduledTime: dose.scheduledAt, status: dose.status }));
  const pendingCount = agendaRows.filter((row) => row.status === "pending").length;
  const { visible: visibleSchedules, hiddenCount } = partitionCareSchedules(careSetup.schedules, schedulesExpanded);

  return (
    <>
      {!canManageCare ? <NoticeBanner text={t("permission.careTeamOnly")} icon="shield" tone="info" /> : null}

      {careStatus === "error" ? (
        <>
          <NoticeBanner text={t("care.loadFailed")} tone="error" icon="close" />
          {onRetryCare ? <SecondaryButton label={t("diary.listRetry")} onPress={onRetryCare} /> : null}
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("care.todayMedicationTitle")}</Text>
        <Text style={styles.countText}>{t("care.todayMedicationProgress").replace("{count}", String(pendingCount))}</Text>
      </View>
      <View style={styles.medList}>
        {agendaRows.length === 0 && careStatus !== "error" ? <Text style={styles.emptyText}>{t(careStatus === "loading" ? "diary.listLoading" : "care.noMedicationToday")}</Text> : null}
        {agendaRows.map((row) => {
          const rowKey = `${row.scheduleId ?? row.doseId}-${row.doseDate}-${row.scheduledTime}`;
          const isEditingRow = Boolean(editingDose && row.doseId === editingDose.id);
          return (
            <View key={rowKey} style={styles.medListItem}>
              <MedicationAgendaRow row={row} onEdit={row.doseId ? () => setEditingDoseId(row.doseId ?? null) : undefined} onStatusChange={(status) => onAgendaStatusChange?.(row, status)} />
              {isEditingRow ? (
                <SurfaceCard>
                  <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} canDelete={canDeleteDose} />
                </SurfaceCard>
              ) : null}
            </View>
          );
        })}
      </View>

      {canManageCare ? (
        <>
          <SecondaryButton label={t("care.addMedication")} icon="add" onPress={() => setAddCardOpen((current) => !current)} />
          {addCardOpen ? <CareMedicationAddCard petId={petId} onAddDose={onAddDose} onSaveCareSetup={onSaveCareSetup} onOpenProfileCare={onOpenProfileCare} onSaved={() => setAddCardOpen(false)} /> : null}
        </>
      ) : null}

      <SurfaceCard>
        <View style={styles.scheduleCard}>
          <Text style={styles.sectionTitle}>{t("care.scheduleSummaryTitle")}</Text>
          {/* Loading/failed setup must not read as "nothing registered" (C3). */}
          {careSetup.schedules.length === 0 ? <Text style={styles.reportCopy}>{t(careStatus === "ready" ? "care.scheduleSummaryCopy" : careStatus === "loading" ? "diary.listLoading" : "care.loadFailed")}</Text> : null}
          {visibleSchedules.map((schedule) => {
            const badge = schedulePeriodBadge(schedule);
            // A schedule outside its window (or off its recurrence day) still
            // lists for reference, but offering "use today" on it would create
            // a dose the plan never asked for today.
            const appliesToday = scheduleAppliesOnDate(schedule, getLocalDateKey());
            const usable = canManageCare && appliesToday;
            return (
              <Pressable
                key={schedule.id}
                accessibilityRole="button"
                accessibilityLabel={`${schedule.localTime.slice(0, 5)}, ${schedule.medicationName}, ${schedule.dosageLabel}${badge ? `, ${badge}` : ""}`}
                accessibilityState={{ disabled: !usable }}
                disabled={!usable}
                style={styles.scheduleRow}
                onPress={() => onUseSchedule(schedule)}
              >
                <AppIcon name="medication" size={iconSize.md} color={colors.orangeDeep} />
                <View style={styles.scheduleBody}>
                  <Text style={styles.medTitle}>{schedule.localTime.slice(0, 5)} · {schedule.medicationName}</Text>
                  <Text style={styles.medMeta}>{schedule.dosageLabel}{badge ? ` · ${badge}` : ""}</Text>
                </View>
                {usable ? <Text style={styles.useText}>{t("care.useToday")}</Text> : null}
                {canManageCare && !appliesToday ? <Text style={styles.medMeta}>{t("care.scheduleNotToday")}</Text> : null}
              </Pressable>
            );
          })}
          {hiddenCount > 0 ? (
            <Pressable accessibilityRole="button" style={styles.moreButton} onPress={() => setSchedulesExpanded(true)}>
              <Text style={styles.moreText}>{t("care.scheduleMore").replace("{count}", String(hiddenCount))}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.profileLinkButton} onPress={onOpenProfileCare}>
            <Text style={styles.profileLinkText}>{t("care.manageRoutineInProfile")}</Text>
          </Pressable>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>{t("care.conditionFromDiaryTitle")}</Text>
        <Text style={styles.reportCopy}>{conditionScore ? `${t("care.latestCondition")} ${conditionScore}/5` : t("care.conditionFromDiaryCopy")}</Text>
      </SurfaceCard>
      {/* The readiness checklist asserts "0/3 · missing" from data that has
          not loaded; hold it back until the sources are ready (C3). */}
      {careStatus === "ready" ? <VetReportReadinessCard doses={doses} conditionScore={conditionScore} careSetup={careSetup} /> : null}
      {canManageReports
        ? <PrimaryButton label={t("care.generateVetReport")} icon="report" onPress={onGenerateReport} />
        : <NoticeBanner text={t("permission.reportCareTeamOnly")} icon="shield" tone="info" />}
    </>
  );
}

function MedicationAgendaRow({ row, onEdit, onStatusChange }: { row: TodayMedicationAgendaRow; onEdit?: () => void; onStatusChange: (status: "completed" | "skipped" | "partial") => void }) {
  const visual = row.status === "completed" ? { accent: colors.mint, icon: colors.mintDeep, label: t("care.status.completed") } : row.status === "skipped" ? { accent: colors.inactive, icon: colors.textSoft, label: t("care.status.skipped") } : row.status === "partial" ? { accent: colors.memo, icon: colors.orangeDeep, label: t("care.status.partial") } : { accent: colors.salmon, icon: colors.salmon, label: t("care.status.pending") };
  // The first tap creates the dose row; a second tap before it lands creates a
  // duplicate that the unique constraint rejects, so the user sees "save
  // failed" for a dose that was in fact saved.
  const [saving, setSaving] = useState(false);
  const submitStatus = (status: "completed" | "skipped" | "partial") => {
    if (saving) return;
    setSaving(true);
    void Promise.resolve(onStatusChange(status)).finally(() => setSaving(false));
  };

  return (
    <View style={styles.agendaRow}>
      <View style={[styles.medAccent, { backgroundColor: visual.accent }]} />
      <AppIcon name="medication" size={iconSize.lg} color={visual.icon} />
      <View style={styles.agendaBody}>
        <Text style={styles.medTitle}>{row.medicationName}</Text>
        <Text style={styles.sourceLabel}>{t(medicationAgendaSourceLabelKey(row))}</Text>
        <Text style={styles.medDetail}>{row.scheduledTime} · {visual.label}</Text>
        {row.conditionName ? <Text style={styles.medMeta}>{t("care.conditionLabel")}: {row.conditionName}</Text> : null}
        {row.dosageLabel ? <Text style={styles.medMeta}>{t("care.dosageLabel")}: {row.dosageLabel}</Text> : null}
        <View style={styles.actionButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.medicationName}: ${t("care.status.completed")}`}
            accessibilityState={{ selected: row.status === "completed" }}
            aria-pressed={row.status === "completed"}
            style={[styles.givenButton, row.status === "completed" && styles.agendaActionSelected]}
            disabled={saving}
            onPress={() => submitStatus("completed")}
          >
            <Text numberOfLines={1} style={styles.givenButtonText}>{careStatusActionLabel("completed")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.medicationName}: ${t("care.status.partial")}`}
            accessibilityState={{ selected: row.status === "partial" }}
            aria-pressed={row.status === "partial"}
            style={[styles.partialButton, row.status === "partial" && styles.agendaActionSelected]}
            disabled={saving}
            onPress={() => submitStatus("partial")}
          >
            <Text numberOfLines={1} style={styles.partialButtonText}>{careStatusActionLabel("partial")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.medicationName}: ${t("care.status.skipped")}`}
            accessibilityState={{ selected: row.status === "skipped" }}
            aria-pressed={row.status === "skipped"}
            style={[styles.skipButton, row.status === "skipped" && styles.agendaActionSelected]}
            disabled={saving}
            onPress={() => submitStatus("skipped")}
          >
            <Text numberOfLines={1} style={styles.skipButtonText}>{careStatusActionLabel("skipped")}</Text>
          </Pressable>
        </View>
      </View>
      {onEdit ? (
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}>
          <Text style={styles.editText}>{t("care.editShort")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
