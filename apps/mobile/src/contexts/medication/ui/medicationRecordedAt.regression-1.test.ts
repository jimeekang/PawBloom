import type { DoseRecord } from "../domain/medication";
import { doseStatusUpdateForEdit } from "./careMedicationPanelState";
import { updateLocalDoseRecord } from "./localMedicationState";

// Regression: ISSUE-MED-TIME-002 — editing a note overwrote the actual administration time.
// Found by /qa on 2026-07-12.
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-12.md
const recordedAt = "2026-07-10T08:15:00.000Z";
const current: DoseRecord = {
  id: "dose-1",
  petId: "pet-1",
  medicationName: "Amoxi",
  scheduledAt: "08:00",
  status: "completed",
  recordedAt,
};

if (doseStatusUpdateForEdit("completed", "completed") !== undefined) {
  throw new Error("an unchanged dose status must be omitted from the update payload");
}
if (doseStatusUpdateForEdit("completed", "partial") !== "partial") {
  throw new Error("a changed dose status must be sent to persistence");
}

const noteOnly = updateLocalDoseRecord(current, { medicationName: "Amoxi", reactionNote: "brighter" });
if (noteOnly.recordedAt !== recordedAt) throw new Error("note-only edits must preserve the actual administration time");

const changedStatus = updateLocalDoseRecord(current, { medicationName: "Amoxi", status: "pending" });
if (changedStatus.recordedAt !== undefined) throw new Error("moving a dose back to pending must clear the administration time");
