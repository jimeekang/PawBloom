import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import type { ChecklistKey } from "./mockUiState";

export function createChecklistFromRecords(entries: DiaryEntry[], doses: DoseRecord[]): Record<ChecklistKey, boolean> {
  return {
    food: entries.some((entry) => entry.category === "food"),
    water: entries.some((entry) => entry.category === "water"),
    walk: entries.some((entry) => entry.category === "walk"),
    stool: entries.some((entry) => entry.category === "stool"),
    condition: entries.some((entry) => entry.category === "condition"),
    memo: entries.some((entry) => entry.category === "memo"),
    medication: doses.some((dose) => dose.status !== "pending"),
    night: entries.some((entry) => entry.category === "memo"),
  };
}

export type DashboardSummary = {
  completedCount: number;
  totalCount: number;
  pendingMedicationCount: number;
  attentionSignals: string[];
};

export function createDashboardSummary(checklist: Record<ChecklistKey, boolean>, entries: DiaryEntry[], doses: DoseRecord[]): DashboardSummary {
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const pendingMedicationCount = doses.filter((dose) => dose.status === "pending").length;
  const attentionSignals = [
    entries.some((entry) => entry.category === "condition" && (entry.conditionScore ?? 5) <= 2) ? "컨디션 점수가 낮아요." : null,
    !entries.some((entry) => entry.category === "water") ? "오늘 물 기록이 아직 없어요." : null,
    doses.some((dose) => dose.status === "partial" || dose.status === "skipped") ? "일부 또는 건너뜬 투약이 있어요." : null,
    entries.some((entry) => entry.category === "stool" && entry.detail?.category === "stool" && (entry.detail.consistency === "diarrhea" || entry.detail.hasBloodOrMucus)) ? "배변 상태 확인이 필요해요." : null,
  ].filter((signal): signal is string => Boolean(signal));

  return {
    completedCount,
    totalCount: Object.keys(checklist).length,
    pendingMedicationCount,
    attentionSignals,
  };
}

export function checklistSummary(key: ChecklistKey) {
  const summaries: Record<ChecklistKey, string> = {
    food: "식사 체크리스트가 기록되었습니다.",
    water: "물 섭취 체크리스트가 기록되었습니다.",
    walk: "산책 체크리스트가 기록되었습니다.",
    stool: "배변 체크리스트가 기록되었습니다.",
    condition: "컨디션 체크리스트가 기록되었습니다.",
    memo: "메모 체크리스트가 기록되었습니다.",
    medication: "투약 체크리스트가 기록되었습니다.",
    night: "야간 체크가 기록되었습니다.",
  };
  return summaries[key];
}
