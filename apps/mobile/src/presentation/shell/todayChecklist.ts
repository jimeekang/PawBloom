import type { DiaryCategory, DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import type { TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { t, type TranslationKey } from "../../i18n/translations";

export type ChecklistKey = Exclude<DiaryCategory, "photo"> | "medication";

export function createChecklistFromRecords(entries: DiaryEntry[], doses: DoseRecord[]): Record<ChecklistKey, boolean> {
  return {
    food: entries.some((entry) => entry.category === "food"),
    water: entries.some((entry) => entry.category === "water"),
    walk: entries.some((entry) => entry.category === "walk"),
    stool: entries.some((entry) => entry.category === "stool"),
    condition: entries.some((entry) => entry.category === "condition"),
    memo: entries.some((entry) => entry.category === "memo"),
    medication: doses.some((dose) => dose.status !== "pending"),
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
    entries.some((entry) => entry.category === "condition" && (entry.conditionScore ?? 5) <= 2) ? t("ko", "today.attentionLowCondition") : null,
    !entries.some((entry) => entry.category === "water") ? t("ko", "today.attentionWaterMissing") : null,
    shouldIncludeMedication && medicationRows.some((dose) => dose.status === "partial" || dose.status === "skipped") ? t("ko", "today.attentionMedication") : null,
    entries.some((entry) => entry.category === "stool" && entry.detail?.category === "stool" && (entry.detail.consistency === "diarrhea" || entry.detail.hasBloodOrMucus)) ? t("ko", "today.attentionStool") : null,
  ].filter((signal) => signal !== null) as string[];

  return {
    completedCount,
    totalCount: summaryKeys.length,
    pendingMedicationCount,
    attentionSignals,
  };
}

export function checklistSummary(key: ChecklistKey) {
  const summaryKeys: Record<ChecklistKey, TranslationKey> = {
    food: "checklist.summary.food",
    water: "checklist.summary.water",
    walk: "checklist.summary.walk",
    stool: "checklist.summary.stool",
    condition: "checklist.summary.condition",
    memo: "checklist.summary.memo",
    medication: "checklist.summary.medication",
  };
  return t("ko", summaryKeys[key]);
}

export function getTodayChecklistOrder({ walkEnabled, includeMedication = true }: { walkEnabled: boolean; includeMedication?: boolean }): ChecklistKey[] {
  const diaryKeys: ChecklistKey[] = walkEnabled
    ? ["food", "water", "walk", "stool", "condition", "memo"]
    : ["food", "water", "stool", "condition", "memo"];

  return includeMedication ? [...diaryKeys.slice(0, -1), "medication", "memo"] : diaryKeys;
}
