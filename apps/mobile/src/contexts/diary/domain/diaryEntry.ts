import type { UUID } from "../../../shared-kernel/types";

export type DiaryCategory = "food" | "water" | "walk" | "stool" | "condition" | "memo";

export type DiaryEntry = {
  id: UUID;
  petId: UUID;
  category: DiaryCategory;
  entryDate: string;
  occurredAt: string;
  summary: string;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
  photoCount?: number;
};

export type CreateDiaryEntryInput = {
  category: DiaryCategory;
  summary: string;
  entryDate?: string;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
  photos?: DiaryPhotoInput[];
};

export type DiaryPhotoInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
};

export function isClinicalSignal(entry: DiaryEntry) {
  return entry.category === "stool" || entry.category === "condition" || (entry.conditionScore ?? 5) <= 2;
}
