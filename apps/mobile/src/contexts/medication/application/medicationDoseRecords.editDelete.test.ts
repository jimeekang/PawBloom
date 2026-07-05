import { buildMedicationDoseUpdatePayload, removeMedicationDoseFromList } from "./medicationDoseRecords";

const payload = buildMedicationDoseUpdatePayload({
  id: "dose-1",
  medicationName: "Amoxi",
  conditionName: "Cough",
  dosageLabel: "1 tablet",
  administeredAmount: "0.5 tablet",
  status: "partial",
  scheduledTime: "21:10",
  reactionNote: "sleepy",
});
const now = new Date();
const expectedScheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 10, 0, 0).toISOString();

if (payload.medication_name !== "Amoxi") throw new Error("update payload must keep medication name");
if (payload.status !== "partial") throw new Error("update payload must keep edited status");
if (payload.scheduled_at !== expectedScheduledAt) throw new Error("update payload must store edited time on the local current date");
if (!String(payload.reaction_note).includes("sleepy")) throw new Error("update payload must encode care note");

const noteOnlyPayload = buildMedicationDoseUpdatePayload({
  id: "dose-2",
  medicationName: "Amoxi",
  reactionNote: "brighter",
});

if ("scheduled_at" in noteOnlyPayload) throw new Error("note-only update payload must not move scheduled time");
if ("status" in noteOnlyPayload) throw new Error("note-only update payload must not change status");
if ("recorded_at" in noteOnlyPayload) throw new Error("note-only update payload must not change recorded time");

const remaining = removeMedicationDoseFromList([{ id: "keep" }, { id: "remove" }], "remove");
if (remaining.length !== 1 || remaining[0]?.id !== "keep") throw new Error("delete helper must remove only the matching dose");
