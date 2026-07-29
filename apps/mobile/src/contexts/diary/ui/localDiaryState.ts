import type { DiaryEntry } from "../domain/diaryEntry";
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
    summary: draft.summary,
    memo: draft.summary.trim() || undefined,
    detail: draft.detail,
    conditionScore: draft.category === "condition" ? draft.conditionScore ?? 3 : undefined,
    photoCount: draft.photos?.length ?? 0,
    photoUrls: draft.photos?.map((photo) => photo.uri),
  };
}

export function updateLocalDiaryEntry(current: DiaryEntry, draft: DraftDiaryEntry & { occurredTime: string }): DiaryEntry {
  const addedPhotoUrls = draft.category === "photo" ? (draft.photos ?? []).map((photo) => photo.uri) : [];
  return {
    ...current,
    category: draft.category,
    origin: draft.origin ?? "diary",
    entryDate: draft.entryDate ?? current.entryDate,
    occurredAt: draft.occurredTime,
    summary: draft.summary,
    memo: draft.summary.trim() || undefined,
    detail: draft.detail,
    conditionScore: draft.category === "condition" ? draft.conditionScore ?? 3 : undefined,
    photoCount: (current.photoCount ?? 0) + addedPhotoUrls.length,
    photoUrls: [...(current.photoUrls ?? []), ...addedPhotoUrls],
  };
}

export function getTodayEntriesForPet(entries: DiaryEntry[], petId: string) {
  const today = getLocalDateKey();
  return entries.filter((entry) => entry.petId === petId && entry.entryDate === today);
}
