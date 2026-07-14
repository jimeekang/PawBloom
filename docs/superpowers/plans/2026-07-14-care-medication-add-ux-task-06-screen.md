---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX: Task 6 화면 재구성

- [x] **Step 4: CareModeScreen 전면 교체**

`apps/mobile/src/presentation/screens/CareModeScreen.tsx` 전체를 다음 내용으로 교체:

```tsx
import { useMemo, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../../contexts/care/domain/carePlan";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { QuickMedicationForm, type QuickMedicationSaveHandler } from "../../contexts/medication/ui/CareMedicationPanel";
import { medicationAgendaSourceLabelKey, type TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { CareMedicationAddCard } from "./CareMedicationAddCard";
import { CareReportPanel } from "./CareReportPanel";
import { partitionCareSchedules, schedulePeriodBadge } from "./careScheduleSummary";

type Segment = "care" | "reports";
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
  canManageCare?: boolean;
  canDeleteDose?: boolean;
  canManageReports?: boolean;
};

export function CareModeScreen({ canManageCare = true, canDeleteDose = true, canManageReports = true, ...props }: CareModeScreenProps) {
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
        <CarePanel {...props} canManageCare={canManageCare} canDeleteDose={canDeleteDose} canManageReports={canManageReports} />
      ) : (
        <CareReportPanel onOpenReports={props.onGenerateReport} canManageReports={canManageReports} />
      )}
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
      {!canManageCare ? <NoticeBanner text={t("ko", "permission.careTeamOnly")} icon="shield" /> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ko", "care.todayMedicationTitle")}</Text>
        <Text style={styles.countText}>{t("ko", "care.todayMedicationProgress")} {pendingCount}</Text>
      </View>
      <View style={styles.medList}>
        {agendaRows.length === 0 ? <Text style={styles.emptyText}>{t("ko", "care.noMedicationToday")}</Text> : null}
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
          <SecondaryButton label={t("ko", "care.addMedication")} icon="add" onPress={() => setAddCardOpen((current) => !current)} />
          {addCardOpen ? <CareMedicationAddCard petId={petId} onAddDose={onAddDose} onSaveCareSetup={onSaveCareSetup} onOpenProfileCare={onOpenProfileCare} onSaved={() => setAddCardOpen(false)} /> : null}
        </>
      ) : null}

      <SurfaceCard>
        <View style={styles.scheduleCard}>
          <Text style={styles.sectionTitle}>{t("ko", "care.scheduleSummaryTitle")}</Text>
          {careSetup.schedules.length === 0 ? <Text style={styles.reportCopy}>{t("ko", "care.scheduleSummaryCopy")}</Text> : null}
          {visibleSchedules.map((schedule) => {
            const badge = schedulePeriodBadge(schedule);
            return (
              <Pressable key={schedule.id} style={styles.scheduleRow} disabled={!canManageCare} onPress={() => onUseSchedule(schedule)}>
                <AppIcon name="medication" size={iconSize.md} color={colors.orangeDeep} />
                <View style={styles.scheduleBody}>
                  <Text style={styles.medTitle}>{schedule.localTime.slice(0, 5)} · {schedule.medicationName}</Text>
                  <Text style={styles.medMeta}>{schedule.dosageLabel}{badge ? ` · ${badge}` : ""}</Text>
                </View>
                {canManageCare ? <Text style={styles.useText}>{t("ko", "care.useToday")}</Text> : null}
              </Pressable>
            );
          })}
          {hiddenCount > 0 ? (
            <Pressable accessibilityRole="button" style={styles.moreButton} onPress={() => setSchedulesExpanded(true)}>
              <Text style={styles.moreText}>{t("ko", "care.scheduleMore").replace("{count}", String(hiddenCount))}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.profileLinkButton} onPress={onOpenProfileCare}>
            <Text style={styles.profileLinkText}>{t("ko", "care.manageRoutineInProfile")}</Text>
          </Pressable>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>{t("ko", "care.conditionFromDiaryTitle")}</Text>
        <Text style={styles.reportCopy}>{conditionScore ? `${t("ko", "care.latestCondition")} ${conditionScore}/5` : t("ko", "care.conditionFromDiaryCopy")}</Text>
      </SurfaceCard>
      {canManageReports
        ? <PrimaryButton label={t("ko", "care.generateVetReport")} icon="report" onPress={onGenerateReport} />
        : <NoticeBanner text={t("ko", "permission.reportCareTeamOnly")} icon="shield" />}
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
        <Text style={styles.sourceLabel}>{t("ko", medicationAgendaSourceLabelKey(row))}</Text>
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
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}>
          <Text style={styles.editText}>{t("ko", "care.editShort")}</Text>
        </Pressable>
      ) : null}
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
  countText: { ...type.caption, color: colors.textMuted },
  medList: {
    gap: spacing.md,
  },
  medListItem: { gap: spacing.sm },
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
  sourceLabel: { ...type.tiny, color: colors.orangeDeep },
  medDetail: { ...type.caption },
  medMeta: { ...type.tiny, color: colors.textMuted },
  actionButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  givenButton: { flex: 1, minHeight: 40, borderRadius: radius.md, backgroundColor: colors.mintDeep, alignItems: "center", justifyContent: "center" },
  givenButtonText: { ...type.bodyStrong, color: colors.white },
  skipButton: { flex: 1, minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  skipButtonText: { ...type.bodyStrong, color: colors.textMuted },
  editButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  editText: { ...type.caption, color: colors.orangeDeep },
  scheduleCard: { gap: spacing.sm },
  scheduleRow: { minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  scheduleBody: { flex: 1 },
  useText: { ...type.caption, color: colors.orangeDeep },
  moreButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  moreText: { ...type.bodyStrong, color: colors.orangeDeep },
  profileLinkButton: { minHeight: 44, justifyContent: "center" },
  profileLinkText: { ...type.caption, color: colors.orangeDeep },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
  },
  reportCopy: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
```

주의: `CareSetupPanel`·`MedicationRow` import와 `temporaryFormOpen` 상태가 이 교체로 사라진다 (교정 #7 포함).
