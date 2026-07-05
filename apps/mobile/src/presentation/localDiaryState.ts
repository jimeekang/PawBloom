import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import { getLocalDateKey } from "../contexts/diary/application/diaryRecords";
import type { DraftDiaryEntry } from "./mockUiState";

export function updateLocalDiaryEntry(current: DiaryEntry, draft: DraftDiaryEntry & { occurredTime: string }): DiaryEntry {
  return { ...current, category: draft.category, origin: draft.origin ?? "diary", entryDate: draft.entryDate ?? current.entryDate, occurredAt: draft.occurredTime, summary: draft.summary || current.summary, memo: draft.summary.trim() || undefined, detail: draft.detail, conditionScore: draft.category === "condition" ? draft.conditionScore ?? 3 : undefined };
}

export function getTodayEntriesForPet(entries: DiaryEntry[], petId: string) {
  const today = getLocalDateKey();
  return entries.filter((entry) => entry.petId === petId && entry.entryDate === today);
}
