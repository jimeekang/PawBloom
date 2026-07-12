import type { OfflineMutation } from "../domain/offlineMutation";
import { registerOfflineReplayHandler } from "./offlineReplayPolicy";
import { replayPendingOfflineMutations } from "./offlineReplayQueue";

function buildMutation(id: string, aggregate: string): OfflineMutation {
  return {
    id,
    clientMutationId: id.replace("offline-", ""),
    aggregate,
    operation: "insert",
    payload: { petId: "pet-1" },
    createdAt: "2026-07-05T01:00:00.000Z",
    attempts: 0,
  };
}

export default runReplayQueueTests();

async function runReplayQueueTests() {
  registerOfflineReplayHandler("queue-applied", "insert", async () => ({ status: "applied", reason: "queue test applied" }));
  registerOfflineReplayHandler("queue-conflict", "insert", async () => ({ status: "conflict", reason: "queue test conflict" }));
  registerOfflineReplayHandler("queue-network", "insert", async () => {
    throw new Error("Network request failed");
  });

  const appliedIds: string[] = [];
  const conflictedIds: string[] = [];
  const retriedIds: string[] = [];
  const store = {
    markMutationApplied: async (id: string) => { appliedIds.push(id); },
    markMutationConflict: async (id: string) => { conflictedIds.push(id); },
    markMutationRetry: async (id: string) => { retriedIds.push(id); },
  };

  const summary = await replayPendingOfflineMutations({
    store: {
      ...store,
      listPendingMutations: async () => [buildMutation("offline-applied-1", "queue-applied"), buildMutation("offline-conflict-1", "queue-conflict")],
    },
  });

  if (summary.applied !== 1 || summary.conflicted !== 1 || appliedIds[0] !== "offline-applied-1" || conflictedIds[0] !== "offline-conflict-1") {
    throw new Error("replay queue must mark applied and conflicted mutations separately");
  }

  const retrySummary = await replayPendingOfflineMutations({
    store: {
      ...store,
      listPendingMutations: async () => [buildMutation("offline-network-1", "queue-network")],
    },
  });

  if (retrySummary.retried !== 1 || retriedIds.at(-1) !== "offline-network-1") {
    throw new Error("replay queue must keep failed network mutations pending for retry");
  }

  const unsupportedSummary = await replayPendingOfflineMutations({
    store: {
      ...store,
      listPendingMutations: async () => [buildMutation("offline-unknown-1", "queue-unknown")],
    },
  });

  if (unsupportedSummary.unsupported !== 1 || conflictedIds.at(-1) !== "offline-unknown-1") {
    throw new Error("replay queue must park mutations without a registered handler as conflicts for review");
  }

  let replayedAfterAccountSwitch = false;
  registerOfflineReplayHandler("queue-account-switch", "insert", async () => {
    replayedAfterAccountSwitch = true;
    return { status: "applied", reason: "must not run" };
  });
  const switchedMutation = { ...buildMutation("offline-user-a", "queue-account-switch"), queuedByUserId: "user-a" };
  const switchedSummary = await replayPendingOfflineMutations({
    store: {
      ...store,
      listPendingMutations: async () => [switchedMutation],
      ownsMutationForCurrentUser: async () => false,
    },
  });
  if (replayedAfterAccountSwitch || switchedSummary.applied + switchedSummary.conflicted + switchedSummary.retried + switchedSummary.unsupported !== 0) {
    throw new Error("replay queue must stop before dispatch when the authenticated account changes");
  }
}
