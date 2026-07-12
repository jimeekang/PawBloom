import type { OfflineMutation } from "../domain/offlineMutation";
import { createWebOutboxStore, type WebOutboxLockProvider, type WebStorageLike } from "./offlineOutbox.web";

async function runWebConflictCountTests() {
  const values = new Map<string, string>();
  const storage: WebStorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  const lock: WebOutboxLockProvider = async (_name, task) => task();
  let userId: string | null = "user-a";
  const store = createWebOutboxStore({ storageProvider: () => storage, userIdProvider: async () => userId, lockProvider: lock });
  const mutation: OfflineMutation = {
    id: "offline-conflict-count",
    clientMutationId: "conflict-count",
    aggregate: "diary",
    operation: "insert",
    payload: {},
    createdAt: "2026-07-12T00:00:00.000Z",
    attempts: 0,
  };

  await store.enqueueOfflineMutation(mutation);
  await store.markMutationConflict(mutation.id, "changed elsewhere");
  if (await store.countConflictedMutations() !== 1) throw new Error("web conflict count must include the signed-in user's parked rows");
  await store.enqueueOfflineMutation({ ...mutation, id: "offline-pending", clientMutationId: "pending" });
  userId = "user-b";
  if (await store.countConflictedMutations() !== 0) throw new Error("web conflict count must not expose another account's rows");
  await store.clearConflictedMutations();
  userId = "user-a";
  if (await store.countConflictedMutations() !== 1) throw new Error("another web account must not clear the owner's conflicts");
  await store.clearConflictedMutations("user-a");
  if (await store.countConflictedMutations() !== 0) throw new Error("reviewed web conflicts must be removable for the current account");
  if ((await store.listPendingMutations()).length !== 1) throw new Error("clearing web conflicts must preserve pending work");
  userId = null;
  if (await store.countConflictedMutations() !== 0) throw new Error("web conflict count must be empty while signed out");
}

export default runWebConflictCountTests();
