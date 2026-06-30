import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import { checklistKeyToDiaryCategory, isChecklistRecordBlocked } from "./checklistActions";
import type { ChecklistKey } from "../mockUiState";

const emptyChecklist: Record<ChecklistKey, boolean> = {
  food: false,
  water: false,
  walk: false,
  stool: false,
  condition: false,
  memo: false,
  medication: false,
  night: false,
};

const todayMemo: DiaryEntry = {
  id: "entry-memo",
  petId: "pet-1",
  category: "memo",
  entryDate: "2026-06-30",
  occurredAt: "21:00",
  summary: "night note",
};

if (checklistKeyToDiaryCategory("night") !== "memo") {
  throw new Error("night checklist records must edit the memo diary category");
}

if (!isChecklistRecordBlocked({ key: "night", checklist: emptyChecklist, entries: [todayMemo], entryDate: "2026-06-30", pendingKeys: [] })) {
  throw new Error("today checklist must block duplicate diary records for the same category");
}

if (isChecklistRecordBlocked({ key: "night", checklist: emptyChecklist, entries: [todayMemo], entryDate: "2026-06-29", pendingKeys: [] })) {
  throw new Error("today checklist must allow the same category on another day");
}

if (!isChecklistRecordBlocked({ key: "food", checklist: emptyChecklist, entries: [], entryDate: "2026-06-30", pendingKeys: ["food"] })) {
  throw new Error("today checklist must block a second tap while the first save is pending");
}
