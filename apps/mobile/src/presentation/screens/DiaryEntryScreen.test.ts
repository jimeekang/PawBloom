import type { CreateDiaryEntryInput } from "../../contexts/diary/domain/diaryEntry";
import { formatDiaryTime, getDiaryEntryDateForSave, getEditableDiaryMemo, isDiaryDetailPanelOpenAfterSave, normalizeDiaryTimeInput, resolveDiarySaveTime, shouldApplyInitialEditingEntry } from "./DiaryEntryScreen.logic";
import { getDiaryCategoryFormState, getDiaryDetailForSave, getDiaryPhotosForSave, getDiarySummaryForSave } from "./DiaryEntryScreen.formRules";

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

if (!shouldApplyInitialEditingEntry({ nextEntryId: "entry-water", currentEditingEntryId: null, lastAppliedEntryId: null })) {
  throw new Error("home timeline entry press must open the matching diary edit screen");
}

if (shouldApplyInitialEditingEntry({ nextEntryId: "entry-water", currentEditingEntryId: null, lastAppliedEntryId: "entry-water" })) {
  throw new Error("diary edit screen must not reopen a consumed timeline edit target");
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

const waterForm = getDiaryCategoryFormState("water");
if (!waterForm.showsDetail || waterForm.showsMemo || waterForm.showsPhotos) {
  throw new Error("structured diary categories must show only their category detail form");
}

const memoForm = getDiaryCategoryFormState("memo");
if (memoForm.showsDetail || !memoForm.showsMemo || memoForm.showsPhotos) {
  throw new Error("memo diary category must show only the memo form");
}

const photoForm = getDiaryCategoryFormState("photo");
if (photoForm.showsDetail || photoForm.showsMemo || !photoForm.showsPhotos) {
  throw new Error("photo diary category must show only the photo picker");
}

const waterDetail = { category: "water" as const, amountMl: "250", intakeLevel: "normal" as const };
if (getDiaryDetailForSave("water", waterDetail) !== waterDetail) {
  throw new Error("structured diary categories must keep their own detail payload");
}

if (getDiaryDetailForSave("memo", { category: "memo" }) !== undefined) {
  throw new Error("memo diary category must not save a structured detail payload");
}

if (getDiaryDetailForSave("photo", { category: "memo" }) !== undefined) {
  throw new Error("photo diary category must not save a structured detail payload");
}

if (getDiarySummaryForSave("water", "extra note") !== "") {
  throw new Error("structured diary categories must not save generic memo text");
}

if (getDiarySummaryForSave("memo", "  slept well  ") !== "slept well") {
  throw new Error("memo diary category must save trimmed memo text");
}

const samplePhotos = [{ uri: "file:///photo.jpg" }];
if (getDiaryPhotosForSave("photo", samplePhotos, false) !== samplePhotos) {
  throw new Error("photo diary category must save selected photos when creating");
}

if (getDiaryPhotosForSave("photo", samplePhotos, true) !== undefined) {
  throw new Error("photo diary category must preserve existing photos when editing until edit support exists");
}

if (getDiaryPhotosForSave("memo", samplePhotos, false) !== undefined) {
  throw new Error("non-photo diary categories must not save photos");
}
