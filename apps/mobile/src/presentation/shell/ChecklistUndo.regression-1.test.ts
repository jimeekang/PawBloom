declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import {
  applyLocalMedicationUndo,
  createDeleteMedicationUndo,
  createRestoreMedicationUndo,
  createRestoreMedicationUndoFromAgenda,
  resolveDiaryChecklistUndo,
} from "./checklistUndo";

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-010 — completed Today items could not safely undo accidental taps
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const checklistEntry: DiaryEntry = {
  id: "entry-checklist",
  petId: "pet-1",
  category: "walk",
  origin: "checklist",
  entryDate: "2026-07-16",
  occurredAt: "09:00",
  summary: "Walk checklist recorded.",
};
const diaryEntry: DiaryEntry = { ...checklistEntry, id: "entry-diary", origin: "diary" };

if (resolveDiaryChecklistUndo([checklistEntry], "walk", "2026-07-16").status !== "ready") {
  throw new Error("checklist-origin Diary records must be eligible for Today undo");
}
if (resolveDiaryChecklistUndo([diaryEntry], "walk", "2026-07-16").status !== "protected") {
  throw new Error("user-authored Diary records must remain protected from Today undo");
}
if (resolveDiaryChecklistUndo([checklistEntry, diaryEntry], "walk", "2026-07-16").status !== "protected") {
  throw new Error("mixed Diary records must not be partially cleared from Today");
}
if (resolveDiaryChecklistUndo([checklistEntry, { ...checklistEntry, id: "entry-checklist-2" }], "walk", "2026-07-16").status !== "unavailable") {
  throw new Error("duplicate checklist records must not expose a misleading aggregate undo");
}

const scheduledDose: DoseRecord = {
  id: "dose-1",
  petId: "pet-1",
  scheduleId: "schedule-1",
  doseDate: "2026-07-16",
  medicationName: "Medication",
  dosageLabel: "1 tablet",
  scheduledAt: "08:00",
  status: "completed",
  reactionNote: "No reaction",
};
const restoreUndo = createRestoreMedicationUndo(scheduledDose);
const restored = applyLocalMedicationUndo([scheduledDose], restoreUndo);
if (restored?.[0]?.status !== "pending" || restored[0].reactionNote !== "No reaction") {
  throw new Error("scheduled medication undo must restore pending without deleting dose details");
}

const editedDose = { ...scheduledDose, reactionNote: "Owner edited this note" };
if (applyLocalMedicationUndo([editedDose], restoreUndo) !== null) {
  throw new Error("medication undo must stop after the dose details change");
}

const oneTimeDose = { ...scheduledDose, id: "dose-2", scheduleId: undefined, doseDate: undefined };
const deleted = applyLocalMedicationUndo([oneTimeDose], createDeleteMedicationUndo(oneTimeDose));
if (!deleted || deleted.length !== 0) {
  throw new Error("a one-time dose created by the checklist must be removable by its exact fingerprint");
}

const scheduleUndo = createRestoreMedicationUndoFromAgenda({
  source: "schedule",
  scheduleId: "schedule-2",
  doseDate: "2026-07-16",
  medicationName: "Course medication",
  dosageLabel: "5 ml",
  scheduledTime: "20:00",
  status: "pending",
}, "pet-1");
const createdScheduleDose: DoseRecord = {
  id: "dose-3",
  petId: "pet-1",
  scheduleId: "schedule-2",
  doseDate: "2026-07-16",
  medicationName: "Course medication",
  dosageLabel: "5 ml",
  scheduledAt: "20:00",
  status: "completed",
};
if (applyLocalMedicationUndo([createdScheduleDose], scheduleUndo)?.[0]?.status !== "pending") {
  throw new Error("a checklist-created scheduled dose must return to pending instead of being deleted");
}

const controllerSource = readFileSync(
  `${process.cwd()}/apps/mobile/src/presentation/shell/useTodayChecklistController.ts`,
  "utf8",
);
if (!controllerSource.includes("if (checklist[key])") || !controllerSource.includes("deleteDiaryEntryRemote")) {
  throw new Error("checked Today items must route through the guarded undo path");
}

const shellSource = readFileSync(
  `${process.cwd()}/apps/mobile/src/presentation/PawBloomShell.tsx`,
  "utf8",
);
if (!shellSource.includes("createChecklistFromRecords(diary.activeEntries, medication.activeDoses)")) {
  throw new Error("preview checklist state must stay derived from the records it displays");
}
