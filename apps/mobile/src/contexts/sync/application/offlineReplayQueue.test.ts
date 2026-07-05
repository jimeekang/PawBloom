import type { OfflineMutation } from "../domain/offlineMutation";
import { replayPendingOfflineMutations } from "./offlineReplayQueue";

const appliedDiary: OfflineMutation = {
  id: "offline-diary-1",
  clientMutationId: "diary-1",
  aggregate: "diary",
  operation: "insert",
  payload: { petId: "pet-1", userId: "user-1", input: { category: "memo", summary: "offline note" } },
  createdAt: "2026-07-05T01:00:00.000Z",
  attempts: 0,
};

const conflictedMedication: OfflineMutation = {
  id: "offline-medication-1",
  clientMutationId: "medication-1",
  aggregate: "medication",
  operation: "update",
  payload: { petId: "pet-1", input: { id: "dose-1", medicationName: "Cerenia", status: "completed" } },
  createdAt: "2026-07-05T01:01:00.000Z",
  attempts: 0,
};

export default runReplayQueueTests();

async function runReplayQueueTests() {
  const appliedIds: string[] = [];
  const conflictedIds: string[] = [];
  const retriedIds: string[] = [];

  const summary = await replayPendingOfflineMutations({
    store: {
      listPendingMutations: async () => [appliedDiary, conflictedMedication],
      markMutationApplied: async (id) => { appliedIds.push(id); },
      markMutationConflict: async (id) => { conflictedIds.push(id); },
      markMutationRetry: async (id) => { retriedIds.push(id); },
    },
    handlers: {
      insertDiaryEntry: async () => undefined,
      getMedicationDose: async () => ({ id: "dose-1", status: "skipped" }),
      updateMedicationDose: async () => {
        throw new Error("conflicted mutation must not update");
      },
    },
  });

  if (summary.applied !== 1 || summary.conflicted !== 1 || appliedIds[0] !== "offline-diary-1" || conflictedIds[0] !== "offline-medication-1") {
    throw new Error("replay queue must mark applied and conflicted mutations separately");
  }

  const retrySummary = await replayPendingOfflineMutations({
    store: {
      listPendingMutations: async () => [appliedDiary],
      markMutationApplied: async () => {
        throw new Error("network failure before completion");
      },
      markMutationConflict: async () => undefined,
      markMutationRetry: async (id) => { retriedIds.push(id); },
    },
    handlers: {
      insertDiaryEntry: async () => {
        throw new Error("Network request failed");
      },
      getMedicationDose: async () => null,
      updateMedicationDose: async () => undefined,
    },
  });

  if (retrySummary.retried !== 1 || retriedIds.at(-1) !== "offline-diary-1") {
    throw new Error("replay queue must keep failed network mutations pending for retry");
  }
}
