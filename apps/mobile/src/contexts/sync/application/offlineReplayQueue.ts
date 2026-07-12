import type { OfflineMutation } from "../domain/offlineMutation";
import { replayOfflineMutation } from "./offlineReplayPolicy";

export type OfflineReplayStore = {
  listPendingMutations: () => Promise<OfflineMutation[]>;
  markMutationApplied: (id: string, expectedUserId?: string) => Promise<void>;
  markMutationConflict: (id: string, reason: string, expectedUserId?: string) => Promise<void>;
  markMutationRetry: (id: string, reason: string, expectedUserId?: string) => Promise<void>;
  ownsMutationForCurrentUser?: (mutation: OfflineMutation) => Promise<boolean>;
};

export type OfflineReplaySummary = {
  applied: number;
  conflicted: number;
  retried: number;
  unsupported: number;
};

export async function replayPendingOfflineMutations(input: { store: OfflineReplayStore }): Promise<OfflineReplaySummary> {
  const summary: OfflineReplaySummary = { applied: 0, conflicted: 0, retried: 0, unsupported: 0 };
  const mutations = await input.store.listPendingMutations();

  for (const mutation of mutations) {
    if (input.store.ownsMutationForCurrentUser && !await input.store.ownsMutationForCurrentUser(mutation)) break;
    try {
      const result = await replayOfflineMutation(mutation);
      if (result.status === "applied") {
        await input.store.markMutationApplied(mutation.id, mutation.queuedByUserId);
        summary.applied += 1;
      } else if (result.status === "conflict") {
        await input.store.markMutationConflict(mutation.id, result.reason, mutation.queuedByUserId);
        summary.conflicted += 1;
      } else if (result.status === "unsupported") {
        await input.store.markMutationConflict(mutation.id, result.reason, mutation.queuedByUserId);
        summary.unsupported += 1;
      } else {
        await input.store.markMutationRetry(mutation.id, result.reason, mutation.queuedByUserId);
        summary.retried += 1;
      }
    } catch (error) {
      await input.store.markMutationRetry(mutation.id, getErrorMessage(error), mutation.queuedByUserId);
      summary.retried += 1;
    }
  }

  return summary;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Offline replay failed.";
}
