import type { OfflineMutation } from "../domain/offlineMutation";
import {
  LEGACY_WEB_OUTBOX_KEY,
  WebOutboxLockUnavailableError,
  createWebOutboxStore,
  webOutboxDeletionTombstoneKey,
  webOutboxStorageKey,
  type WebOutboxLockProvider,
  type WebStorageLike,
} from "./offlineOutbox.web";

async function runWebAccountPurgeTests() {
  await verifyLegacyRowsAreDiscarded();
  await verifyAuthoritativeAccountPurge();
  await verifyTombstonePrecedesActiveReplayDrain();
  await verifyUnavailablePersistenceIsNotReportedAsPurged();
}

async function verifyLegacyRowsAreDiscarded() {
  const fixture = createMemoryStorage();
  const legacyMutation = mutation("legacy", "2026-07-12T00:00:00.000Z");
  fixture.values.set(LEGACY_WEB_OUTBOX_KEY, JSON.stringify([
    { mutation: legacyMutation, attempts: 0, status: "pending", updatedAt: legacyMutation.createdAt },
  ]));
  const store = createWebOutboxStore({
    storageProvider: () => fixture.storage,
    userIdProvider: async () => "user-a",
    lockProvider: immediateLock,
  });

  assert((await store.listPendingMutations()).length === 0, "unscoped legacy payloads must never be replayed");
  assert(!fixture.values.has(LEGACY_WEB_OUTBOX_KEY), "unscoped legacy payloads must be discarded");
}

async function verifyAuthoritativeAccountPurge() {
  const fixture = createMemoryStorage();
  let userId: string | null = "user/a";
  const store = createWebOutboxStore({
    storageProvider: () => fixture.storage,
    userIdProvider: async () => userId,
    lockProvider: immediateLock,
  });
  const conflict = mutation("purge-conflict", "2026-07-12T00:00:00.000Z");
  await store.enqueueOfflineMutation(conflict);
  await store.markMutationConflict(conflict.id, "reviewed", "user/a");
  userId = "user/b";
  await store.enqueueOfflineMutation(mutation("purge-other-user", "2026-07-12T00:01:00.000Z"));

  const userAKey = webOutboxStorageKey("user/a");
  const userBKey = webOutboxStorageKey("user/b");
  fixture.values.set(`${userAKey}.corrupt.1234`, "broken-a");
  fixture.values.set(`${userAKey}.corrupt.5678`, "broken-a-again");
  fixture.values.set(`${userBKey}.corrupt.1234`, "broken-b");
  fixture.values.set(LEGACY_WEB_OUTBOX_KEY, "legacy");
  userId = null;
  assert(fixture.values.has(userAKey), "ordinary sign-out must retain the account's web queue");

  await store.purgeOfflineMutationsForAccount("user/a");
  assert(fixture.values.get(webOutboxDeletionTombstoneKey("user/a")) === "deleted",
    "authoritative account deletion must persist an account-scoped web tombstone");
  assert(!fixture.values.has(userAKey), "authoritative account deletion must remove the explicit account's web queue");
  assert(!fixture.values.has(`${userAKey}.corrupt.1234`) && !fixture.values.has(`${userAKey}.corrupt.5678`),
    "authoritative account deletion must remove every corrupt backup for the explicit account");
  assert(!fixture.values.has(LEGACY_WEB_OUTBOX_KEY), "authoritative account deletion must remove the unscoped legacy queue");
  assert(fixture.values.has(userBKey) && fixture.values.has(`${userBKey}.corrupt.1234`),
    "authoritative account deletion must preserve every other account's web data");
  userId = "user/b";
  assert((await store.listPendingMutations()).length === 1,
    "another account's web queue must remain replayable after the explicit purge");
  userId = "user/a";
  await store.enqueueOfflineMutation(mutation("deleted-account-enqueue", "2026-07-12T00:02:00.000Z"));
  assert((await store.listPendingMutations()).length === 0,
    "the current tab must not enqueue or replay a tombstoned web account");
  const restartedStore = createWebOutboxStore({
    storageProvider: () => fixture.storage,
    userIdProvider: async () => "user/a",
    lockProvider: immediateLock,
  });
  await restartedStore.enqueueOfflineMutation(mutation("deleted-after-restart", "2026-07-12T00:03:00.000Z"));
  assert((await restartedStore.listPendingMutations()).length === 0,
    "a persisted web tombstone must block enqueue and replay after restart");

  const memoryFixture = createMemoryStorage();
  const unavailableLock: WebOutboxLockProvider = async () => { throw new WebOutboxLockUnavailableError(); };
  let memoryUserId: string | null = "memory-a";
  const memoryStore = createWebOutboxStore({
    storageProvider: () => memoryFixture.storage,
    userIdProvider: async () => memoryUserId,
    lockProvider: unavailableLock,
  });
  await memoryStore.enqueueOfflineMutation(mutation("purge-memory-a", "2026-07-12T00:00:00.000Z"));
  memoryUserId = "memory-b";
  await memoryStore.enqueueOfflineMutation(mutation("purge-memory-b", "2026-07-12T00:01:00.000Z"));
  memoryUserId = null;
  await memoryStore.purgeOfflineMutationsForAccount("memory-a");
  memoryUserId = "memory-a";
  await memoryStore.enqueueOfflineMutation(mutation("deleted-memory-a", "2026-07-12T00:02:00.000Z"));
  assert((await memoryStore.listPendingMutations()).length === 0,
    "an in-memory tombstone must remove and block the explicit account's fallback rows");
  memoryUserId = "memory-b";
  assert((await memoryStore.listPendingMutations()).length === 1,
    "authoritative account deletion must preserve another account's in-memory fallback rows");

  const retryState = { targetKey: webOutboxStorageKey("retry-user"), failuresRemaining: 1, attempts: 0 };
  const retryFixture = createMemoryStorage(retryState);
  const retryStore = createWebOutboxStore({
    storageProvider: () => retryFixture.storage,
    userIdProvider: async () => "retry-user",
    lockProvider: immediateLock,
  });
  await retryStore.enqueueOfflineMutation(mutation("retry-purge", "2026-07-12T00:00:00.000Z"));
  await retryStore.purgeOfflineMutationsForAccount("retry-user");
  assert(retryState.attempts === 2 && !retryFixture.values.has(retryState.targetKey),
    "web account purge must retry and verify a transient row-removal failure");

  const lockFailureFixture = createMemoryStorage();
  const lockFailureStore = createWebOutboxStore({
    storageProvider: () => lockFailureFixture.storage,
    userIdProvider: async () => "lock-failure-user",
    lockProvider: async () => { throw new Error("lock failure"); },
  });
  let lockFailureObserved = false;
  try {
    await lockFailureStore.purgeOfflineMutationsForAccount("lock-failure-user");
  } catch {
    lockFailureObserved = true;
  }
  assert(lockFailureObserved
    && lockFailureFixture.values.get(webOutboxDeletionTombstoneKey("lock-failure-user")) === "deleted",
    "the durable web tombstone must be written before a fallible cross-tab lock");
  const recoveryStore = createWebOutboxStore({
    storageProvider: () => lockFailureFixture.storage,
    userIdProvider: async () => "lock-failure-user",
    lockProvider: immediateLock,
  });
  assert((await recoveryStore.listPendingMutations()).length === 0,
    "a later web access must retain the lock-failure tombstone and retry physical cleanup");
}

async function verifyUnavailablePersistenceIsNotReportedAsPurged() {
  const store = createWebOutboxStore({
    storageProvider: () => null,
    userIdProvider: async () => "no-storage-user",
    lockProvider: immediateLock,
  });
  await store.enqueueOfflineMutation(mutation("no-storage", "2026-07-12T00:00:00.000Z"));
  let purgeResolved = true;
  try {
    await store.purgeOfflineMutationsForAccount("no-storage-user");
  } catch {
    purgeResolved = false;
  }
  assert(!purgeResolved, "web purge must not claim durable success when persistent storage is unavailable");
  await store.enqueueOfflineMutation(mutation("no-storage-after-delete", "2026-07-12T00:01:00.000Z"));
  assert((await store.listPendingMutations()).length === 0,
    "the current runtime must remain fail-closed after durable web purge verification fails");
}

async function verifyTombstonePrecedesActiveReplayDrain() {
  const fixture = createMemoryStorage();
  const store = createWebOutboxStore({
    storageProvider: () => fixture.storage,
    userIdProvider: async () => "active-replay-user",
    lockProvider: immediateLock,
  });
  await store.enqueueOfflineMutation(mutation("active-replay", "2026-07-12T00:00:00.000Z"));
  const pending = (await store.listPendingMutations())[0]!;
  let signalStarted: () => void = () => undefined;
  let releaseReplay: () => void = () => undefined;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const replayGate = new Promise<void>((resolve) => { releaseReplay = resolve; });
  const replay = store.runWithMutationReplayLease(pending, async () => {
    signalStarted();
    await replayGate;
  });
  await started;

  let purgeFinished = false;
  const purge = store.purgeOfflineMutationsForAccount("active-replay-user").then(() => { purgeFinished = true; });
  assert(fixture.values.get(webOutboxDeletionTombstoneKey("active-replay-user")) === "deleted" && !purgeFinished,
    "the durable tombstone must precede waiting for an active remote replay handler");
  releaseReplay();
  await replay;
  await purge;
  assert(purgeFinished && !fixture.values.has(webOutboxStorageKey("active-replay-user")),
    "physical account cleanup must finish after the active replay handler drains");
}

const immediateLock: WebOutboxLockProvider = async (_name, task) => await task();
function mutation(name: string, createdAt: string): OfflineMutation {
  return { id: `offline-${name}`, clientMutationId: `client-${name}`, aggregate: "diary", operation: "insert", payload: { name }, createdAt, attempts: 0 };
}
function createMemoryStorage(retryState?: { targetKey: string; failuresRemaining: number; attempts: number }) {
  const values = new Map<string, string>();
  const storage: WebStorageLike = {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => {
      if (retryState && key === retryState.targetKey) {
        retryState.attempts += 1;
        if (retryState.failuresRemaining > 0) {
          retryState.failuresRemaining -= 1;
          throw new Error("transient remove failure");
        }
      }
      values.delete(key);
    },
  };
  return { storage, values };
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export default runWebAccountPurgeTests();
