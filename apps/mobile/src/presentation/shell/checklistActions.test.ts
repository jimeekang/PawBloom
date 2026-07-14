import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import { checklistKeyToDiaryCategory, createLocalChecklistRecord, isChecklistRecordBlocked } from "./checklistActions";
import type { ChecklistKey } from "./todayChecklist";

const emptyChecklist: Record<ChecklistKey, boolean> = {
  food: false,
  water: false,
  walk: false,
  stool: false,
  condition: false,
  memo: false,
  medication: false,
};

const todayMemo: DiaryEntry = {
  id: "entry-memo",
  petId: "pet-1",
  category: "memo",
  origin: "diary",
  entryDate: "2026-06-30",
  occurredAt: "21:00",
  summary: "memo note",
};

const todayFood: DiaryEntry = {
  id: "entry-food",
  petId: "pet-1",
  category: "food",
  origin: "diary",
  entryDate: "2026-06-30",
  occurredAt: "08:00",
  summary: "breakfast",
};

if (checklistKeyToDiaryCategory("memo") !== "memo") {
  throw new Error("memo checklist records must use the memo diary category");
}

if (!isChecklistRecordBlocked({ key: "memo", checklist: emptyChecklist, entries: [todayMemo], entryDate: "2026-06-30", pendingKeys: [] })) {
  throw new Error("today checklist must block duplicate diary records for the same category");
}

if (isChecklistRecordBlocked({ key: "memo", checklist: emptyChecklist, entries: [todayMemo], entryDate: "2026-06-29", pendingKeys: [] })) {
  throw new Error("today checklist must allow the same category on another day");
}

if (!isChecklistRecordBlocked({ key: "food", checklist: emptyChecklist, entries: [], entryDate: "2026-06-30", pendingKeys: ["food"] })) {
  throw new Error("today checklist must block a second tap while the first save is pending");
}

if (!isChecklistRecordBlocked({ key: "food", checklist: emptyChecklist, entries: [todayFood], entryDate: "2026-06-30", pendingKeys: [] })) {
  throw new Error("today checklist must block duplicate structured category records for the same day");
}

const checklistResult = createLocalChecklistRecord({
  key: "food",
  entryDate: "2026-07-01",
  activePetId: "pet-1",
  entries: [],
  doses: [],
  activeDoses: [],
  checklist: emptyChecklist,
  quickMedicationName: "Medication",
});

if (checklistResult?.nextEntries?.[0]?.origin !== "checklist") {
  throw new Error("checklist-created diary timeline records must carry checklist origin");
}
