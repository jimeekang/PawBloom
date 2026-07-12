import type { DiaryCategory, DiaryRecordOrigin } from "../domain/diaryEntry";
import { isStructuredDailyCategory } from "./diaryRecordPayload";

export type DiaryUniqueConflictAction = "already-applied" | "update-canonical" | "keep-canonical" | "conflict";

export function resolveDiaryUniqueConflict({
  category,
  origin,
  hasClientMutationMatch,
  hasCanonical,
}: {
  category: DiaryCategory;
  origin: DiaryRecordOrigin;
  hasClientMutationMatch: boolean;
  hasCanonical: boolean;
}): DiaryUniqueConflictAction {
  if (hasClientMutationMatch) return "already-applied";
  if (!isStructuredDailyCategory(category) || !hasCanonical) return "conflict";
  return origin === "checklist" ? "keep-canonical" : "update-canonical";
}

export function shouldApplyDiaryReplayOverCanonical(mutationCreatedAt: string, canonicalUpdatedAt: string) {
  const mutationTime = Date.parse(mutationCreatedAt);
  const canonicalTime = Date.parse(canonicalUpdatedAt);
  return Number.isFinite(mutationTime) && Number.isFinite(canonicalTime) && mutationTime >= canonicalTime;
}
