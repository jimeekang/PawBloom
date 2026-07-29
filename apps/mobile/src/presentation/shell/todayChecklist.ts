import type { DiaryCategory, DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import type { TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { t } from "../../i18n/translations";

export type ChecklistKey = Exclude<DiaryCategory, "photo"> | "medication";

export function createChecklistFromRecords(entries: DiaryEntry[], doses: DoseRecord[], medicationAgenda: Pick<TodayMedicationAgendaRow, "status">[] = []): Record<ChecklistKey, boolean> {
  // The tile and the hero counter must agree (0007 D3): with scheduled doses
  // still pending, one recorded dose used to mark the tile "recorded" while
  // the hero said "N left to check" beside it. The tile is done only when
  // something was recorded and nothing on today's agenda is still pending.
  const medicationRows = medicationAgenda.length > 0 ? medicationAgenda : doses;
  return {
    food: entries.some((entry) => entry.category === "food"),
    water: entries.some((entry) => entry.category === "water"),
    walk: entries.some((entry) => entry.category === "walk"),
    stool: entries.some((entry) => entry.category === "stool"),
    condition: entries.some((entry) => entry.category === "condition"),
    memo: entries.some((entry) => entry.category === "memo"),
    medication: medicationRows.some((row) => row.status !== "pending") && !medicationRows.some((row) => row.status === "pending"),
  };
}

export type DashboardSummary = {
  completedCount: number;
  totalCount: number;
  pendingMedicationCount: number;
  attentionSignals: string[];
};

export function createDashboardSummary(checklist: Record<ChecklistKey, boolean>, entries: DiaryEntry[], doses: DoseRecord[], visibleKeys?: ChecklistKey[], medicationAgenda: Pick<TodayMedicationAgendaRow, "status">[] = []): DashboardSummary {
  const summaryKeys = visibleKeys ?? (Object.keys(checklist) as ChecklistKey[]);
  const shouldIncludeMedication = !visibleKeys || visibleKeys.includes("medication");
  const medicationRows = medicationAgenda.length > 0 ? medicationAgenda : doses;
  const completedCount = summaryKeys.filter((key) => checklist[key]).length;
  const pendingMedicationCount = shouldIncludeMedication ? medicationRows.filter((dose) => dose.status === "pending").length : 0;
  const attentionSignals = [
    entries.some((entry) => entry.category === "condition" && (entry.conditionScore ?? 5) <= 2) ? t("today.attentionLowCondition") : null,
    !entries.some((entry) => entry.category === "water") ? t("today.attentionWaterMissing") : null,
    shouldIncludeMedication && medicationRows.some((dose) => dose.status === "partial" || dose.status === "skipped") ? t("today.attentionMedication") : null,
    entries.some((entry) => entry.category === "stool" && entry.detail?.category === "stool" && (entry.detail.consistency === "diarrhea" || entry.detail.hasBloodOrMucus)) ? t("today.attentionStool") : null,
  ].filter((signal) => signal !== null) as string[];

  return {
    completedCount,
    totalCount: summaryKeys.length,
    pendingMedicationCount,
    attentionSignals,
  };
}

export function getTodayChecklistOrder({ walkEnabled, includeMedication = true }: { walkEnabled: boolean; includeMedication?: boolean }): ChecklistKey[] {
  const diaryKeys: ChecklistKey[] = walkEnabled
    ? ["food", "water", "walk", "stool", "condition", "memo"]
    : ["food", "water", "stool", "condition", "memo"];

  return includeMedication ? [...diaryKeys.slice(0, -1), "medication", "memo"] : diaryKeys;
}
