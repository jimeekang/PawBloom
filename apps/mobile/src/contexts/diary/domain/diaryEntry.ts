import type { UUID } from "../../../shared-kernel/types";

export type DiaryCategory = "food" | "water" | "walk" | "stool" | "condition" | "memo" | "photo";
export type DiaryRecordOrigin = "diary" | "checklist";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type AppetiteLevel = "good" | "normal" | "low" | "refused";
export type RelativeLevel = "less" | "normal" | "more";
export type WalkIntensity = "low" | "normal" | "high";
export type StoolConsistency = "normal" | "soft" | "diarrhea" | "hard";

export type DiaryDetailInput =
  | { category: "food"; meals: Partial<Record<MealSlot, { offeredGrams?: string; eatenGrams?: string }>>; appetite?: AppetiteLevel }
  | { category: "water"; amountMl?: string; intakeLevel?: RelativeLevel }
  | { category: "walk"; durationMinutes?: string; intensity?: WalkIntensity; observation?: string; stoolObservation?: string; urineObservation?: string; symptomNote?: string }
  | { category: "stool"; count?: string; consistency?: StoolConsistency; hasBloodOrMucus?: boolean }
  | { category: "condition"; energyLevel?: RelativeLevel; discomfortNote?: string }
  | { category: "memo" };

export type DiaryEntry = {
  id: UUID;
  petId: UUID;
  category: DiaryCategory;
  origin: DiaryRecordOrigin;
  entryDate: string;
  occurredAt: string;
  summary: string;
  memo?: string;
  detail?: DiaryDetailInput;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
  photoCount?: number;
  photoUrls?: string[];
};

export type CreateDiaryEntryInput = {
  category: DiaryCategory;
  summary: string;
  detail?: DiaryDetailInput;
  entryDate?: string;
  occurredTime?: string;
  origin?: DiaryRecordOrigin;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
  photos?: DiaryPhotoInput[];
  clientMutationId?: UUID;
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
