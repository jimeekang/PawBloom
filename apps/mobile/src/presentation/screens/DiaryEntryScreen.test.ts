import type { CreateDiaryEntryInput } from "../../contexts/diary/domain/diaryEntry";
import { formatDiaryTime, getDiaryEntryDateForSave, getEditableDiaryMemo, isDiaryDetailPanelOpenAfterSave, normalizeDiaryTimeInput, resolveDiarySaveTime } from "./DiaryEntryScreen";

if (isDiaryDetailPanelOpenAfterSave(true) !== false) {
  throw new Error("diary detail panel must close after saving an entry");
}

if (normalizeDiaryTimeInput("8:05") !== "08:05") {
  throw new Error("diary time input must normalize one-digit hours");
}

if (normalizeDiaryTimeInput("24:00") !== undefined) {
  throw new Error("diary time input must reject invalid hours");
}

if (formatDiaryTime(new Date(2026, 0, 1, 9, 7)) !== "09:07") {
  throw new Error("diary current time helper must format HH:mm");
}

if (resolveDiarySaveTime("24:00", true) !== undefined) {
  throw new Error("dirty invalid diary time must block save");
}

if (resolveDiarySaveTime("24:00", false, new Date(2026, 0, 1, 9, 7)) !== "09:07") {
  throw new Error("untouched create time must use current time at save");
}

const createInputWithTime: CreateDiaryEntryInput = { category: "memo", summary: "late note", occurredTime: "21:35" };
if (createInputWithTime.occurredTime !== "21:35") throw new Error("remote diary create input must accept edited record time");

if (getDiaryEntryDateForSave("2026-06-28", { entryDate: "2026-06-24" }) !== "2026-06-24") {
  throw new Error("diary edit mode must preserve the edited entry date");
}

const editableMemo = getEditableDiaryMemo({
  id: "entry-test",
  petId: "pet-test",
  category: "memo",
  entryDate: "2026-06-28",
  occurredAt: "08:15",
  summary: "Ate breakfast well",
});

if (editableMemo !== "Ate breakfast well") {
  throw new Error("diary edit mode must load summary as editable memo fallback");
}

const legacyPlainMemo = getEditableDiaryMemo({
  id: "entry-legacy",
  petId: "pet-test",
  category: "water",
  entryDate: "2026-06-28",
  occurredAt: "10:15",
  summary: "Drank more water than usual",
});

if (legacyPlainMemo !== "Drank more water than usual") {
  throw new Error("diary edit mode must preserve plain legacy summaries");
}

const structuredMemo = getEditableDiaryMemo({
  id: "entry-structured",
  petId: "pet-test",
  category: "water",
  entryDate: "2026-06-28",
  occurredAt: "10:15",
  summary: "Water 250ml · Normal",
  detail: { category: "water", amountMl: "250", intakeLevel: "normal" },
});

if (structuredMemo !== "") {
  throw new Error("diary edit mode must not copy generated detail summaries into memo");
}

const structuredRawMemo = getEditableDiaryMemo({
  id: "entry-structured-memo",
  petId: "pet-test",
  category: "water",
  entryDate: "2026-06-28",
  occurredAt: "10:15",
  summary: "Water 250ml · drank after walk",
  memo: "drank after walk",
  detail: { category: "water", amountMl: "250", intakeLevel: "normal" },
});

if (structuredRawMemo !== "drank after walk") {
  throw new Error("diary edit mode must load raw memo for structured entries");
}
