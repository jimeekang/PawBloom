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
    food: "Food checklist item recorded.",
    water: "Water checklist item recorded.",
    walk: "Walk checklist item recorded.",
    stool: "Stool checklist item recorded.",
    condition: "Condition checklist item recorded.",
    memo: "Memo checklist item recorded.",
    medication: "Medication checklist item recorded.",
    night: "Night check recorded.",
  };
  return summaries[key];
}
