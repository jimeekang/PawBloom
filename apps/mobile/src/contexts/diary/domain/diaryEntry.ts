import type { UUID } from "../../../shared-kernel/types";

export type DiaryCategory = "food" | "water" | "walk" | "stool" | "condition" | "memo";

export type DiaryEntry = {
  id: UUID;
  petId: UUID;
  category: DiaryCategory;
  occurredAt: string;
  summary: string;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
};

export function isClinicalSignal(entry: DiaryEntry) {
  return entry.category === "stool" || entry.category === "condition" || (entry.conditionScore ?? 5) <= 2;
}

