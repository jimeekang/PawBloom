import type { DiaryCategory, DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { checklistSummary, createChecklistFromRecords, type ChecklistKey } from "./todayChecklist";
import { createLocalDoseRecord } from "../../contexts/medication/ui/localMedicationState";
import { createLocalDiaryEntry } from "../../contexts/diary/ui/localDiaryState";

export function checklistKeyToDiaryCategory(key: ChecklistKey): DiaryCategory | null {
  if (key === "medication") return null;
  return key;
}

export function isChecklistRecordBlocked({
  key,
  checklist,
  entries,
  entryDate,
  pendingKeys,
  hasPendingMedicationAgenda = false,
}: {
  key: ChecklistKey;
  checklist: Record<ChecklistKey, boolean>;
  entries: DiaryEntry[];
  entryDate: string;
  pendingKeys: ChecklistKey[];
  hasPendingMedicationAgenda?: boolean;
}) {
  if (pendingKeys.includes(key)) return true;
  // 남은 pending 투약이 있으면 이미 완료 dose가 있어도 타일로 계속 기록할 수 있어야 한다
  // (히어로의 "확인할 투약 N"과 잠긴 타일이 모순되는 것을 방지).
  if (key === "medication" && hasPendingMedicationAgenda) return false;
  if (checklist[key]) return true;

  const diaryCategory = checklistKeyToDiaryCategory(key);
  if (!diaryCategory) return false;

  return entries.some((entry) => entry.entryDate === entryDate && entry.category === diaryCategory);
}

export function createLocalChecklistRecord({
  key,
  entryDate,
  activePetId,
  entries,
  doses,
  activeDoses,
  checklist,
  quickMedicationName,
}: {
  key: ChecklistKey;
  entryDate: string;
  activePetId: string;
  entries: DiaryEntry[];
  doses: DoseRecord[];
  activeDoses: DoseRecord[];
  checklist: Record<ChecklistKey, boolean>;
  quickMedicationName: string;
}) {
  if (key === "medication") {
    const pendingDose = activeDoses.find((dose) => dose.status === "pending");
    const nextDoses = pendingDose
      ? doses.map((dose) => (dose.id === pendingDose.id ? { ...dose, status: "completed" as const, recordedAt: new Date().toISOString() } : dose))
      : [createLocalDoseRecord(activePetId, { medicationName: quickMedicationName, status: "completed" }, quickMedicationName), ...doses];
    return { nextDoses, nextChecklist: { ...checklist, medication: true }, noticeKey: "today.medicationUpdated" as const, feedbackKind: "medicationStatus" as const };
  }

  const category = checklistKeyToDiaryCategory(key);
  if (!category) return null;
  const nextEntry = createLocalDiaryEntry(activePetId, { category, summary: checklistSummary(key), entryDate, occurredAt: formatChecklistTime(), conditionScore: category === "condition" ? 3 : undefined, origin: "checklist" });
  const nextEntries = [nextEntry, ...entries];
  return { nextEntries, nextChecklist: createChecklistFromRecords(nextEntries.filter((entry) => entry.petId === activePetId && entry.entryDate === entryDate), activeDoses), noticeKey: "today.diarySaved" as const, feedbackKind: "checklist" as const };
}

export async function recordRemoteChecklistItem({
  key,
  activeDoses,
  quickMedicationName,
  createDiaryEntry,
  createMedicationDose,
  updateMedicationDoseStatus,
}: {
  key: ChecklistKey;
  activeDoses: DoseRecord[];
  quickMedicationName: string;
  createDiaryEntry: (input: { category: DiaryCategory; summary: string; origin?: "diary" | "checklist"; conditionScore?: 1 | 2 | 3 | 4 | 5 }) => Promise<unknown>;
  createMedicationDose: (input: { medicationName: string; status: "completed" }) => Promise<unknown>;
  updateMedicationDoseStatus: (input: { id: string; status: "completed" }) => Promise<unknown>;
}) {
  if (key === "medication") {
    const pendingDose = activeDoses.find((dose) => dose.status === "pending");
    if (pendingDose) await updateMedicationDoseStatus({ id: pendingDose.id, status: "completed" });
    else await createMedicationDose({ medicationName: quickMedicationName, status: "completed" });
    return "medicationStatus" as const;
  }

  const category = checklistKeyToDiaryCategory(key);
  if (!category) return "checklist" as const;
  await createDiaryEntry({ category, summary: checklistSummary(key), conditionScore: category === "condition" ? 3 : undefined, origin: "checklist" });
  return "checklist" as const;
}

function formatChecklistTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
