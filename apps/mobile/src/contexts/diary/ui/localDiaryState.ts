import type { DiaryCategory, DiaryEntry } from "../domain/diaryEntry";
import { getLocalDateKey } from "../../../shared-kernel/date";
import type { DraftDiaryEntry } from "./draftDiaryEntry";

export function createLocalDiaryEntry(petId: string, draft: DraftDiaryEntry): DiaryEntry {
  return {
    id: `entry-local-${Date.now()}`,
    petId,
    category: draft.category,
    origin: draft.origin ?? "diary",
    entryDate: draft.entryDate ?? getLocalDateKey(),
    occurredAt: draft.occurredAt,
    summary: draft.summary || defaultSummary[draft.category],
    memo: draft.summary.trim() || undefined,
    detail: draft.detail,
    conditionScore: draft.category === "condition" ? draft.conditionScore ?? 3 : undefined,
    photoCount: draft.photos?.length ?? 0,
  };
}

export function updateLocalDiaryEntry(current: DiaryEntry, draft: DraftDiaryEntry & { occurredTime: string }): DiaryEntry {
  return { ...current, category: draft.category, origin: draft.origin ?? "diary", entryDate: draft.entryDate ?? current.entryDate, occurredAt: draft.occurredTime, summary: draft.summary || current.summary, memo: draft.summary.trim() || undefined, detail: draft.detail, conditionScore: draft.category === "condition" ? draft.conditionScore ?? 3 : undefined };
}

export function getTodayEntriesForPet(entries: DiaryEntry[], petId: string) {
  const today = getLocalDateKey();
  return entries.filter((entry) => entry.petId === petId && entry.entryDate === today);
}

const defaultSummary: Record<DiaryCategory, string> = {
  food: "잘 먹음",
  water: "물 섭취 기록",
  walk: "산책 완료",
  stool: "배변 기록",
  condition: "컨디션 확인",
  memo: "메모 추가",
  photo: "사진 추가",
};
