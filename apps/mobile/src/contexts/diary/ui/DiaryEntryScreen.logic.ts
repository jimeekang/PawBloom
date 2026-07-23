import type { DiaryCategory, DiaryEntry } from "../domain/diaryEntry";

const structuredDailyCategories = new Set<DiaryCategory>(["food", "water", "walk", "stool", "condition"]);

export function isStructuredDailyDiaryCategory(category: DiaryCategory) {
  return structuredDailyCategories.has(category);
}

export function findEditableDailyStructuredEntry(entries: DiaryEntry[], category: DiaryCategory, dateKey: string) {
  if (!isStructuredDailyDiaryCategory(category)) return undefined;
  return entries.find((entry) => entry.category === category && entry.entryDate === dateKey);
}

export function isDiaryDetailPanelOpenAfterSave(_wasOpen: boolean) {
  return false;
}

export function normalizeDiaryTimeInput(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function resolveDiarySaveTime(value: string, mustUseInput: boolean, now = new Date()) {
  const normalized = normalizeDiaryTimeInput(value);
  if (mustUseInput && !normalized) return undefined;
  return mustUseInput ? normalized : formatDiaryTime(now);
}

export function getDiaryEntryDateForSave(selectedDateKey: string, editingEntry?: Pick<DiaryEntry, "entryDate"> | null) {
  return editingEntry?.entryDate ?? selectedDateKey;
}

export function getEditableDiaryMemo(entry: DiaryEntry) {
  return entry.memo ?? (entry.detail ? "" : entry.summary);
}

export function shouldResetDiaryCategorySelection({
  categories,
  selected,
  isEditing,
}: {
  categories: DiaryCategory[];
  selected: DiaryCategory;
  isEditing: boolean;
}) {
  // 편집 중에는 비활성 카테고리(예: 산책 꺼짐)의 기존 기록이라도 원래 카테고리를 보존해야 한다.
  // 여기서 리셋하면 저장 시 detail이 food로 덮어써지는 데이터 손상이 난다.
  return !isEditing && !categories.includes(selected);
}

export function shouldApplyInitialEditingEntry({
  nextEntryId,
  currentEditingEntryId,
  lastAppliedEntryId,
}: {
  nextEntryId?: string | null;
  currentEditingEntryId?: string | null;
  lastAppliedEntryId?: string | null;
}) {
  return Boolean(nextEntryId) && nextEntryId !== currentEditingEntryId && nextEntryId !== lastAppliedEntryId;
}

export function resolvePendingDiaryCreateMutation(
  current: { fingerprint: string; id: string } | null,
  fingerprint: string,
  createId: () => string,
) {
  return current?.fingerprint === fingerprint ? current : { fingerprint, id: createId() };
}

export function resolveRemoteDiarySaveOutcome(queued: boolean) {
  return queued ? "queued" as const : "saved" as const;
}

export function formatDiaryTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
