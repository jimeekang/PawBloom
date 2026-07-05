import type { OfflineMutation } from "../domain/offlineMutation";
import { replayOfflineMutation, resolveMedicationDoseReplayDecision } from "./offlineReplayPolicy";

const diaryMutation: OfflineMutation = {
  id: "offline-diary-1",
  clientMutationId: "diary-1",
  aggregate: "diary",
  operation: "insert",
  payload: { petId: "pet-1", userId: "user-1", input: { category: "walk", summary: "20 minute walk", entryDate: "2026-07-05" } },
  createdAt: "2026-07-05T01:00:00.000Z",
  attempts: 0,
};

if (resolveMedicationDoseReplayDecision({ serverStatus: "pending", localStatus: "completed" }) !== "apply") {
  throw new Error("pending medication doses must accept offline status replay");
}

if (resolveMedicationDoseReplayDecision({ serverStatus: "skipped", localStatus: "completed" }) !== "conflict") {
  throw new Error("different non-pending medication dose states must be held as conflicts");
}

export default runReplayPolicyTests();

async function runReplayPolicyTests() {
  let insertedDiaryClientMutationId = "";
  const diaryResult = await replayOfflineMutation(diaryMutation, {
    insertDiaryEntry: async ({ clientMutationId }) => {
      insertedDiaryClientMutationId = clientMutationId;
    },
    getMedicationDose: async () => null,
    updateMedicationDose: async () => undefined,
  });

  if (diaryResult.status !== "applied" || insertedDiaryClientMutationId !== "diary-1") {
    throw new Error("diary insert replay must apply with the original client mutation id");
  }

  const medicationMutation: OfflineMutation = {
    id: "offline-medication-1",
    clientMutationId: "medication-1",
    aggregate: "medication",
    operation: "update",
    payload: { petId: "pet-1", input: { id: "dose-1", medicationName: "Cerenia", status: "completed" } },
    createdAt: "2026-07-05T01:01:00.000Z",
    attempts: 0,
  };

  let updatedDoseId = "";
  const medicationResult = await replayOfflineMutation(medicationMutation, {
    insertDiaryEntry: async () => undefined,
    getMedicationDose: async () => ({ id: "dose-1", status: "pending" }),
    updateMedicationDose: async ({ input }) => {
      updatedDoseId = input.id;
    },
  });

  if (medicationResult.status !== "applied" || updatedDoseId !== "dose-1") {
    throw new Error("pending medication dose replay must update the stored dose");
  }

  const conflictResult = await replayOfflineMutation(medicationMutation, {
    insertDiaryEntry: async () => undefined,
    getMedicationDose: async () => ({ id: "dose-1", status: "skipped" }),
    updateMedicationDose: async () => {
      throw new Error("conflicted medication replay must not update the server row");
    },
  });

  if (conflictResult.status !== "conflict" || !conflictResult.reason.includes("already")) {
    throw new Error("conflicted medication dose replay must be reported for user review");
  }
}
