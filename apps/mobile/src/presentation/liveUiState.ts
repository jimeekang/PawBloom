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
