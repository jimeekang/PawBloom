import { buildDiaryInsertOfflineMutation, buildDiaryReplayInsertPayload, buildMedicationDoseReplayUpdatePayload, buildMedicationDoseUpdateOfflineMutation } from "./offlineMutationPayload";

const diaryMutation = buildDiaryInsertOfflineMutation({
  petId: "pet-1",
  userId: "user-1",
  input: { category: "walk", summary: "", entryDate: "2026-07-05", detail: { category: "walk", durationMinutes: "20" } },
  clientMutationId: "mutation-1",
  createdAt: "2026-07-05T00:00:00.000Z",
});

if (diaryMutation.aggregate !== "diary" || diaryMutation.operation !== "insert") throw new Error("diary insert failures must become diary insert outbox mutations");
if (diaryMutation.clientMutationId !== "mutation-1" || diaryMutation.attempts !== 0) throw new Error("offline mutation must keep idempotency id and start with zero attempts");
if (diaryMutation.payload.petId !== "pet-1" || diaryMutation.payload.userId !== "user-1") throw new Error("diary offline payload must keep pet and user ownership context");

const medicationMutation = buildMedicationDoseUpdateOfflineMutation({
  petId: "pet-1",
  input: { id: "dose-1", medicationName: "Cerenia", status: "completed" },
  clientMutationId: "mutation-2",
  createdAt: "2026-07-05T00:01:00.000Z",
});

if (medicationMutation.aggregate !== "medication" || medicationMutation.operation !== "update") throw new Error("medication update failures must become medication update outbox mutations");
const medicationInput = medicationMutation.payload.input as { id?: string };
if (medicationInput.id !== "dose-1") throw new Error("medication offline payload must keep the dose update input");

const diaryReplayPayload = buildDiaryReplayInsertPayload({
  petId: "pet-1",
  userId: "user-1",
  clientMutationId: "mutation-1",
  input: { category: "walk", summary: "walk memo", entryDate: "2026-07-05", occurredTime: "08:30" },
});

if (diaryReplayPayload.client_mutation_id !== "mutation-1" || diaryReplayPayload.pet_id !== "pet-1") {
  throw new Error("diary replay insert payload must keep idempotency and ownership fields");
}

const medicationReplayPayload = buildMedicationDoseReplayUpdatePayload({
  clientMutationId: "mutation-2",
  input: { id: "dose-1", medicationName: "Cerenia", status: "completed", reactionNote: "Settled" },
});

if (medicationReplayPayload.client_mutation_id !== "mutation-2" || medicationReplayPayload.status !== "completed" || !medicationReplayPayload.recorded_at) {
  throw new Error("medication replay update payload must keep idempotency and recorded status fields");
}
