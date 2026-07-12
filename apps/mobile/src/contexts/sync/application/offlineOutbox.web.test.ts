import type { OfflineMutation } from "../domain/offlineMutation";
import {
  LEGACY_WEB_OUTBOX_KEY,
  WebOutboxLockUnavailableError,
  createWebOutboxStore,
  webOutboxStorageKey,
  type WebOutboxLockProvider,
  type WebStorageLike,
} from "./offlineOutbox.web";

async function runWebOutboxTests() {
  await verifyAccountIsolationPersistenceAndCloning();
  await verifyLegacyRowsAreDiscarded();
  await verifyConflictAndRetrySemantics();
  await verifyMalformedStorageRecovery();
  await verifyCrossTabSerialization();
  await verifyAuthRevalidatedAfterLockWait();
  await verifyStorageReadFailureFailsClosed();
  await verifySafeFallbacks();
}

async function verifyAccountIsolationPersistenceAndCloning() {
  const fixture = createMemoryStorage();
  let userId: string | null = "user/a";
  const options = () => ({
    storageProvider: () => fixture.storage,
    userIdProvider: async () => userId,
    lockProvider: immediateLock,
  });
  const store = createWebOutboxStore(options());
  const later = mutation("later", "2026-07-12T00:01:00.000Z");
  const earlier = mutation("earlier", "2026-07-12T00:00:00.000Z", { nested: { value: "original" } });

  await store.enqueueOfflineMutation(later);
  await store.enqueueOfflineMutation(earlier);
  await store.enqueueOfflineMutation({ ...earlier, id: "duplicate-client-id" });
  (earlier.payload.nested as { value: string }).value = "caller-mutated";

  let pending = await createWebOutboxStore(options()).listPendingMutations();
  assert(pending.length === 2 && pending[0]?.id === earlier.id && pending[1]?.id === later.id,
    "web outbox must persist, deduplicate, and order a user's mutations");
  assert((pending[0]?.payload.nested as { value: string }).value === "original",
    "enqueue must deep-clone nested mutation payloads");
  (pending[0]!.payload.nested as { value: string }).value = "result-mutated";
  pending = await store.listPendingMutations();
  assert((pending[0]?.payload.nested as { value: string }).value === "original",
    "listed mutations must not alias persisted nested payloads");

  userId = "user/b";
  assert((await store.listPendingMutations()).length === 0, "one user must not read another user's queue");
  await store.enqueueOfflineMutation(mutation("user-b", "2026-07-12T00:02:00.000Z"));

  userId = null;
  assert((await store.listPendingMutations()).length === 0, "a missing session must return no replay candidates");
  await store.enqueueOfflineMutation(mutation("signed-out", "2026-07-12T00:03:00.000Z"));

  userId = "user/a";
  pending = await store.listPendingMutations();
  assert(pending.length === 2 && !pending.some((row) => row.id === "offline-signed-out"),
    "signed-out writes must not enter a later user's queue");
  assert(fixture.values.has(webOutboxStorageKey("user/a")) && fixture.values.has(webOutboxStorageKey("user/b")),
    "each authenticated user must have a separate storage key");
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

async function verifyConflictAndRetrySemantics() {
  const fixture = createMemoryStorage();
  const store = fixedUserStore(fixture.storage);
  const row = mutation("conflict", "2026-07-12T00:00:00.000Z");
  await store.enqueueOfflineMutation(row);
  await store.markMutationRetry(row.id, "offline");
  assert((await store.listPendingMutations())[0]?.attempts === 1, "pending retry must increment attempts");
  await store.markMutationConflict(row.id, "changed elsewhere");
  await store.markMutationRetry(row.id, "still offline");
  assert((await store.listPendingMutations()).length === 0, "retry must not revive a conflicted mutation");
}

async function verifyMalformedStorageRecovery() {
  const fixture = createMemoryStorage();
  const key = webOutboxStorageKey("user-a");
  fixture.values.set(key, "{bad json");
  let currentTime = 1234;
  const options = {
    storageProvider: () => fixture.storage,
    userIdProvider: async () => "user-a",
    lockProvider: immediateLock,
    now: () => currentTime,
  };
  const store = createWebOutboxStore(options);
  assert((await store.listPendingMutations()).length === 0, "malformed rows must not be replayed");
  assert(fixture.values.get(`${key}.corrupt.1234`) === "{bad json", "malformed rows must be backed up");
  assert(fixture.values.get(key) === "[]", "malformed storage must be reset to a valid queue");

  currentTime = 1235;
  fixture.values.set(key, "");
  const emptyRecoveryStore = createWebOutboxStore(options);
  assert((await emptyRecoveryStore.listPendingMutations()).length === 0, "empty malformed storage must not be replayed");
  assert(fixture.values.get(`${key}.corrupt.1235`) === "", "empty malformed storage must also be backed up");

  const recovered = mutation("recovered", "2026-07-12T00:00:00.000Z");
  await emptyRecoveryStore.enqueueOfflineMutation(recovered);
  assert((await createWebOutboxStore(options).listPendingMutations())[0]?.id === recovered.id,
    "localStorage persistence must recover after malformed data is reset");
}

async function verifyCrossTabSerialization() {
  const fixture = createMemoryStorage();
  const lockNames: string[] = [];
  const lockProvider = createSerialLock(lockNames);
  const options = {
    storageProvider: () => fixture.storage,
    userIdProvider: async () => "shared-user",
    lockProvider,
  };
  const firstTab = createWebOutboxStore(options);
  const secondTab = createWebOutboxStore(options);
  await Promise.all([
    firstTab.enqueueOfflineMutation(mutation("tab-one", "2026-07-12T00:00:00.000Z")),
    secondTab.enqueueOfflineMutation(mutation("tab-two", "2026-07-12T00:01:00.000Z")),
  ]);
  const pending = await firstTab.listPendingMutations();
  assert(pending.length === 2, "cross-tab read-modify-write operations must not lose mutations");
  assert(lockNames.length === 3 && new Set(lockNames).size === 1, "the same user queue must use one shared lock name");
}

async function verifyAuthRevalidatedAfterLockWait() {
  const fixture = createMemoryStorage();
  let userId: string | null = "user-a";
  await createWebOutboxStore({
    storageProvider: () => fixture.storage,
    userIdProvider: async () => userId,
    lockProvider: immediateLock,
  }).enqueueOfflineMutation(mutation("secret", "2026-07-12T00:00:00.000Z"));

  let release: () => void = () => undefined;
  let reached: () => void = () => undefined;
  const requested = new Promise<void>((resolve) => { reached = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const delayedLock: WebOutboxLockProvider = async (_name, task) => {
    reached();
    await gate;
    return task();
  };
  const waitingStore = createWebOutboxStore({
    storageProvider: () => fixture.storage,
    userIdProvider: async () => userId,
    lockProvider: delayedLock,
  });
  const pendingRequest = waitingStore.listPendingMutations();
  await requested;
  userId = "user-b";
  release();
  assert((await pendingRequest).length === 0, "auth must be revalidated after waiting for the user lock");
}

async function verifyStorageReadFailureFailsClosed() {
  const fixture = createMemoryStorage();
  let failReads = false;
  const firstTabStorage: WebStorageLike = {
    ...fixture.storage,
    getItem: (key) => {
      if (failReads) throw new Error("read blocked");
      return fixture.storage.getItem(key);
    },
  };
  const firstTab = fixedUserStore(firstTabStorage);
  const secondTab = fixedUserStore(fixture.storage);
  const row = mutation("stale", "2026-07-12T00:00:00.000Z");
  await firstTab.enqueueOfflineMutation(row);
  assert((await firstTab.listPendingMutations()).length === 1, "test setup must observe the pending row");
  await secondTab.markMutationConflict(row.id, "conflict in another tab");
  failReads = true;
  assert((await firstTab.listPendingMutations()).length === 0,
    "storage read failure must not replay a stale row cached before another tab's conflict");
}

async function verifySafeFallbacks() {
  const fixture = createMemoryStorage();
  const unavailableLock: WebOutboxLockProvider = async () => { throw new WebOutboxLockUnavailableError(); };
  const options = {
    storageProvider: () => fixture.storage,
    userIdProvider: async () => "user-a",
    lockProvider: unavailableLock,
  };
  const memoryStore = createWebOutboxStore(options);
  const row = mutation("memory", "2026-07-12T00:00:00.000Z", { nested: { value: "original" } });
  await memoryStore.enqueueOfflineMutation(row);
  (row.payload.nested as { value: string }).value = "caller-mutated";
  const memoryRows = await memoryStore.listPendingMutations();
  assert(memoryRows[0]?.id === row.id, "lock fallback must retain rows in this tab");
  assert((memoryRows[0]?.payload.nested as { value: string }).value === "original",
    "memory fallback must deep-clone nested payloads");
  (memoryRows[0]!.payload.nested as { value: string }).value = "result-mutated";
  assert(((await memoryStore.listPendingMutations())[0]?.payload.nested as { value: string }).value === "original",
    "memory fallback results must not alias stored nested payloads");
  assert(!fixture.values.has(webOutboxStorageKey("user-a")), "lock fallback must not perform unsafe shared writes");
  assert((await createWebOutboxStore(options).listPendingMutations()).length === 0,
    "a new tab must not consume another tab's lockless memory queue");

  const blocked = createMemoryStorage({ failWrites: true });
  const blockedStore = fixedUserStore(blocked.storage);
  await blockedStore.enqueueOfflineMutation(row);
  assert((await blockedStore.listPendingMutations())[0]?.id === row.id,
    "storage write failures must retain rows in this tab's memory fallback");
}

function fixedUserStore(storage: WebStorageLike) {
  return createWebOutboxStore({ storageProvider: () => storage, userIdProvider: async () => "user-a", lockProvider: immediateLock });
}

const immediateLock: WebOutboxLockProvider = async (_name, task) => await task();
function createSerialLock(names: string[]): WebOutboxLockProvider {
  let tail = Promise.resolve();
  return async (_name, task) => {
    names.push(_name);
    const previous = tail;
    let release: () => void = () => undefined;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await task(); } finally { release(); }
  };
}

function mutation(name: string, createdAt: string, payload: Record<string, unknown> = { name }): OfflineMutation {
  return { id: `offline-${name}`, clientMutationId: `client-${name}`, aggregate: "diary", operation: "insert", payload, createdAt, attempts: 0 };
}

function createMemoryStorage(options: { failWrites?: boolean } = {}) {
  const values = new Map<string, string>();
  const storage: WebStorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (options.failWrites) throw new Error("write blocked");
      values.set(key, value);
    },
    removeItem: (key) => { values.delete(key); },
  };
  return { storage, values };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export default runWebOutboxTests();
