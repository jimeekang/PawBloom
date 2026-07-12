import { buildMedicationDoseInsertPayload } from "./medicationDosePayload";
import {
  buildMedicationDoseInsertOfflineMutation,
  buildMedicationDoseReplayInsertPayload,
  buildMedicationDoseReplayUpdatePayload,
  resolveMedicationDoseReplayDecision,
} from "./medicationOfflineReplay";

// Regression: ISSUE-MED-OFFLINE-004 — replay after midnight moved a one-time dose to a new date and skipped note-only edits.
// Found by /qa on 2026-07-12.
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-12.md
const firstAttempt = new Date("2026-07-12T13:59:30.000Z");
const insertPayload = buildMedicationDoseInsertPayload({
  petId: "pet-1",
  userId: "user-1",
  medicationName: "Cerenia",
  scheduledTime: "23:59",
  status: "completed",
  now: firstAttempt,
  clientMutationId: "11111111-1111-4111-8111-111111111111",
});
const mutation = buildMedicationDoseInsertOfflineMutation({
  petId: "pet-1",
  userId: "user-1",
  input: { medicationName: "Cerenia", scheduledTime: "23:59", status: "completed" },
  insertPayload,
  clientMutationId: "11111111-1111-4111-8111-111111111111",
  createdAt: firstAttempt.toISOString(),
});
const replayedInsert = buildMedicationDoseReplayInsertPayload({
  petId: "pet-1",
  userId: "user-1",
  clientMutationId: mutation.clientMutationId,
  input: mutation.payload.input as Record<string, unknown>,
  insertPayload: mutation.payload.insertPayload as Record<string, unknown>,
});

if (replayedInsert.dose_date !== insertPayload.dose_date || replayedInsert.scheduled_at !== insertPayload.scheduled_at) {
  throw new Error("offline replay must preserve the date and scheduled time from the first save attempt");
}
if (replayedInsert.recorded_at !== insertPayload.recorded_at || replayedInsert.client_mutation_id !== insertPayload.client_mutation_id) {
  throw new Error("offline replay must preserve administration time and idempotency from the first attempt");
}

const storedUpdate = buildMedicationDoseReplayUpdatePayload({
  clientMutationId: "22222222-2222-4222-8222-222222222222",
  input: { id: "dose-1", medicationName: "Cerenia", reactionNote: "brighter" },
  storedPayload: {
    medication_name: "Cerenia",
    reaction_note: '{"version":1,"reactionNote":"brighter"}',
    scheduled_at: "2026-07-12T13:59:00.000Z",
    updated_at: "2026-07-12T14:00:00.000Z",
  },
});
if (storedUpdate.scheduled_at !== "2026-07-12T13:59:00.000Z" || storedUpdate.client_mutation_id !== "22222222-2222-4222-8222-222222222222") {
  throw new Error("offline updates must replay the exact stored time and idempotency key");
}
if (resolveMedicationDoseReplayDecision({ serverStatus: "completed", localStatus: "completed", hasFieldChanges: true }) !== "apply") {
  throw new Error("matching status must not suppress medication name, note, amount, or time edits");
}
if (resolveMedicationDoseReplayDecision({ serverStatus: "completed", localStatus: "completed", hasFieldChanges: true, serverClientMutationId: "same", clientMutationId: "same" }) !== "already_applied") {
  throw new Error("a matching mutation id must prevent duplicate replay");
}
