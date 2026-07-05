import type { OfflineMutation } from "../domain/offlineMutation";
import { replayOfflineMutation, type OfflineReplayHandlers } from "./offlineReplayPolicy";

export type OfflineReplayStore = {
  listPendingMutations: () => Promise<OfflineMutation[]>;
  markMutationApplied: (id: string) => Promise<void>;
  markMutationConflict: (id: string, reason: string) => Promise<void>;
  markMutationRetry: (id: string, reason: string) => Promise<void>;
};

export type OfflineReplaySummary = {
  applied: number;
  conflicted: number;
  retried: number;
  unsupported: number;
};

export async function replayPendingOfflineMutations(input: { store: OfflineReplayStore; handlers: OfflineReplayHandlers }): Promise<OfflineReplaySummary> {
  const summary: OfflineReplaySummary = { applied: 0, conflicted: 0, retried: 0, unsupported: 0 };
  const mutations = await input.store.listPendingMutations();

  for (const mutation of mutations) {
    try {
      const result = await replayOfflineMutation(mutation, input.handlers);
      if (result.status === "applied") {
        await input.store.markMutationApplied(mutation.id);
        summary.applied += 1;
      } else if (result.status === "conflict") {
        await input.store.markMutationConflict(mutation.id, result.reason);
        summary.conflicted += 1;
      } else if (result.status === "unsupported") {
        await input.store.markMutationConflict(mutation.id, result.reason);
        summary.unsupported += 1;
      } else {
        await input.store.markMutationRetry(mutation.id, result.reason);
        summary.retried += 1;
      }
    } catch (error) {
      await input.store.markMutationRetry(mutation.id, getErrorMessage(error));
      summary.retried += 1;
    }
  }

  return summary;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Offline replay failed.";
}
