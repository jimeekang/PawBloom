import type { CreateDiaryEntryInput } from "../domain/diaryEntry";
import { findEditableDailyStructuredEntry, formatDiaryTime, getDiaryEntryDateForSave, getEditableDiaryMemo, isDiaryDetailPanelOpenAfterSave, isStructuredDailyDiaryCategory, normalizeDiaryTimeInput, resolveDiarySaveTime, resolvePendingDiaryCreateMutation, resolveRemoteDiarySaveOutcome, shouldApplyInitialEditingEntry } from "./DiaryEntryScreen.logic";
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

const firstMutation = resolvePendingDiaryCreateMutation(null, "same-draft", () => "mutation-1");
const retryMutation = resolvePendingDiaryCreateMutation(firstMutation, "same-draft", () => "mutation-2");
const changedMutation = resolvePendingDiaryCreateMutation(firstMutation, "changed-draft", () => "mutation-3");
if (retryMutation.id !== "mutation-1") throw new Error("a failed diary save must reuse its idempotency id on unchanged retry");
if (changedMutation.id !== "mutation-3") throw new Error("editing a failed diary draft must allocate a new idempotency id");
if (resolveRemoteDiarySaveOutcome(true) !== "queued" || resolveRemoteDiarySaveOutcome(false) !== "saved") {
  throw new Error("offline queue acceptance must be a successful queued outcome, not a failed diary save");
}

const createInputWithTime: CreateDiaryEntryInput = { category: "memo", summary: "late note", occurredTime: "21:35" };
if (createInputWithTime.occurredTime !== "21:35") throw new Error("remote diary create input must accept edited record time");

const existingFood = {
  id: "entry-food",
  petId: "pet-1",
  category: "food" as const,
  origin: "diary" as const,
  entryDate: "2026-07-01",
  occurredAt: "08:00",
  summary: "아침 80g/100g",
};

const existingChecklistFood = { ...existingFood, id: "entry-food-checklist", origin: "checklist" as const };

if (!isStructuredDailyDiaryCategory("food")) {
  throw new Error("food must be treated as one detailed daily diary category");
}

if (isStructuredDailyDiaryCategory("memo")) {
  throw new Error("memo must remain appendable");
}

if (isStructuredDailyDiaryCategory("photo")) {
  throw new Error("photo diary entries must remain appendable instead of being merged into one daily entry");
}

if (findEditableDailyStructuredEntry([existingFood], "food", "2026-07-01")?.id !== "entry-food") {
  throw new Error("saving the same structured diary category should find the existing daily record");
}

if (findEditableDailyStructuredEntry([existingChecklistFood], "food", "2026-07-01")?.id !== "entry-food-checklist") {
  throw new Error("saving a detailed diary record after a checklist completion must update the existing daily category record");
}

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
  origin: "diary",
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
  origin: "diary",
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
  origin: "diary",
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
  origin: "diary",
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

if (getDiarySummaryForSave("photo", "hidden memo from another category") !== "") {
  throw new Error("photo saves must not persist a memo field that is hidden by the photo-only form");
}

const samplePhotos = [{ uri: "file:///photo.jpg" }];
if (getDiaryPhotosForSave("photo", samplePhotos, false) !== samplePhotos) {
  throw new Error("photo diary category must save selected photos when creating");
}

if (getDiaryPhotosForSave("photo", samplePhotos, true) !== samplePhotos) {
  throw new Error("photo diary edits must save only the newly selected photos for append");
}

if (getDiaryPhotosForSave("memo", samplePhotos, false) !== undefined) {
  throw new Error("non-photo diary categories must not save photos");
}

declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };
const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const diaryScreenSource = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/diary/ui/DiaryEntryScreen.tsx`, "utf8");
if (!diaryScreenSource.includes("if (!editingEntry)") || !diaryScreenSource.includes("disabled={Boolean(editingEntry)}")) {
  throw new Error("diary edit mode must keep category immutable until an atomic conversion workflow exists");
}
