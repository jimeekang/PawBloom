import { buildMedicationDoseInsertOfflineMutation, buildMedicationDoseReplayInsertPayload, buildMedicationDoseReplayUpdatePayload, buildMedicationDoseUpdateOfflineMutation, resolveMedicationDoseReplayDecision } from "./medicationOfflineReplay";

const medicationInsertMutation = buildMedicationDoseInsertOfflineMutation({
  petId: "pet-1",
  userId: "user-1",
  input: { scheduleId: "schedule-1", doseDate: "2026-07-05", scheduledTime: "08:30", medicationName: "Cerenia", status: "completed" },
  clientMutationId: "mutation-1",
  createdAt: "2026-07-05T00:00:00.000Z",
});

if (medicationInsertMutation.aggregate !== "medication" || medicationInsertMutation.operation !== "insert") {
  throw new Error("medication insert failures must become medication insert outbox mutations");
}

const medicationInsertPayload = buildMedicationDoseReplayInsertPayload({
  petId: "pet-1",
  userId: "user-1",
  clientMutationId: "mutation-1",
  input: medicationInsertMutation.payload.input as Record<string, unknown>,
});

if (medicationInsertPayload.client_mutation_id !== "mutation-1" || medicationInsertPayload.schedule_id !== "schedule-1" || medicationInsertPayload.dose_date !== "2026-07-05") {
  throw new Error("medication replay insert payload must keep idempotency, schedule, and date fields");
}

const medicationMutation = buildMedicationDoseUpdateOfflineMutation({
  petId: "pet-1",
  input: { id: "dose-1", medicationName: "Cerenia", status: "completed" },
  clientMutationId: "mutation-2",
  createdAt: "2026-07-05T00:01:00.000Z",
});

if (medicationMutation.aggregate !== "medication" || medicationMutation.operation !== "update") throw new Error("medication update failures must become medication update outbox mutations");
const medicationInput = medicationMutation.payload.input as { id?: string };
if (medicationInput.id !== "dose-1") throw new Error("medication offline payload must keep the dose update input");

const medicationReplayPayload = buildMedicationDoseReplayUpdatePayload({
  clientMutationId: "mutation-2",
  input: { id: "dose-1", medicationName: "Cerenia", status: "completed", reactionNote: "Settled" },
});

if (medicationReplayPayload.client_mutation_id !== "mutation-2" || medicationReplayPayload.status !== "completed" || !medicationReplayPayload.recorded_at) {
  throw new Error("medication replay update payload must keep idempotency and recorded status fields");
}

if (resolveMedicationDoseReplayDecision({ serverStatus: "pending", localStatus: "completed" }) !== "apply") {
  throw new Error("pending medication doses must accept offline status replay");
}

if (resolveMedicationDoseReplayDecision({ serverStatus: "skipped", localStatus: "completed" }) !== "conflict") {
  throw new Error("different non-pending medication dose states must be held as conflicts");
}

if (resolveMedicationDoseReplayDecision({ serverStatus: null, localStatus: "completed" }) !== "missing") {
  throw new Error("deleted medication doses must be reported as missing");
}

if (resolveMedicationDoseReplayDecision({ serverStatus: "completed", localStatus: "completed" }) !== "already_applied") {
  throw new Error("matching medication dose states must be treated as already applied");
}
