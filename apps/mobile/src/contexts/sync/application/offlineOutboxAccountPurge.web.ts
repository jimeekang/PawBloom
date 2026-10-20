import { blockOfflineReplayForAccount } from "./offlineReplayBarrier";

export const LEGACY_WEB_OUTBOX_KEY = "pawbloom.sync_outbox.v1";
const STORAGE_PREFIX = "pawbloom.sync_outbox.v2";
const DELETED_ACCOUNT_PREFIX = "pawbloom.sync_outbox.deleted.v1";
const LOCK_PREFIX = "pawbloom.sync_outbox.lock";
const TOMBSTONE_VALUE = "deleted";
const ACCOUNT_PURGE_ATTEMPTS = 3;

export type WebStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  readonly length?: number;
  key?: (index: number) => string | null;
};

export type WebOutboxLockProvider = <T>(name: string, task: () => T | Promise<T>) => Promise<T>;

export class WebOutboxLockUnavailableError extends Error {
  constructor() {
    super("A cross-tab outbox lock is unavailable.");
    this.name = "WebOutboxLockUnavailableError";
  }
}

export function webOutboxStorageKey(userId: string) {
  return `${STORAGE_PREFIX}.${encodeURIComponent(userId)}`;
}

export function webOutboxDeletionTombstoneKey(userId: string) {
  return `${DELETED_ACCOUNT_PREFIX}.${encodeURIComponent(userId)}`;
}

type AccountPurgerOptions = {
  memoryRows: { delete: (userId: string) => boolean; has: (userId: string) => boolean };
  memoryTombstones: Set<string>;
  storageProvider: () => WebStorageLike | null;
  lockProvider: WebOutboxLockProvider;
};

export function createWebOutboxAccountBoundary({
  memoryRows,
  memoryTombstones,
  storageProvider,
  lockProvider,
}: AccountPurgerOptions) {
  function isAccountDeletionTombstoned(userId: string) {
    assertExplicitUserId(userId);
    if (memoryTombstones.has(userId)) {
      retryPhysicalPurge(userId);
      return true;
    }
    try {
      const storage = storageProvider();
      if (storage?.getItem(webOutboxDeletionTombstoneKey(userId)) !== TOMBSTONE_VALUE) return false;
      memoryTombstones.add(userId);
      retryPhysicalPurge(userId);
      return true;
    } catch {
      // A storage read failure cannot prove that this account is safe to
      // replay. Block this operation and retry on the next call.
      return true;
    }
  }

  async function purgeOfflineMutationsForAccount(userId: string) {
    assertExplicitUserId(userId);
    const replayDrain = blockOfflineReplayForAccount(userId);
    memoryTombstones.add(userId);
    persistDeletionTombstone(storageProvider, userId);
    await replayDrain;
    const purge = () => purgeAndVerifyAccountRows(memoryRows, memoryTombstones, storageProvider, userId);
    try {
      return await lockProvider(`${LOCK_PREFIX}.${encodeURIComponent(userId)}`, purge);
    } catch (error) {
      if (!(error instanceof WebOutboxLockUnavailableError)) throw error;
      return purge();
    }
  }

  function retryPhysicalPurge(userId: string) {
    try {
      purgeAndVerifyAccountRows(memoryRows, memoryTombstones, storageProvider, userId);
    } catch {
      // The durable marker still blocks enqueue/replay. Every later access
      // retries removal until storage is writable again.
    }
  }

  return { isAccountDeletionTombstoned, purgeOfflineMutationsForAccount };
}

function persistDeletionTombstone(
  storageProvider: AccountPurgerOptions["storageProvider"],
  userId: string,
) {
  const storage = storageProvider();
  if (!storage) throw new Error("Persistent web storage is unavailable for an account deletion tombstone.");
  let lastError: unknown;
  for (let attempt = 0; attempt < ACCOUNT_PURGE_ATTEMPTS; attempt += 1) {
    try {
      const key = webOutboxDeletionTombstoneKey(userId);
      storage.setItem(key, TOMBSTONE_VALUE);
      if (storage.getItem(key) === TOMBSTONE_VALUE) return;
      throw new Error("Web account deletion tombstone could not be verified.");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Web account deletion tombstone failed.");
}

function purgeAndVerifyAccountRows(
  memoryRows: AccountPurgerOptions["memoryRows"],
  memoryTombstones: AccountPurgerOptions["memoryTombstones"],
  storageProvider: AccountPurgerOptions["storageProvider"],
  userId: string,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < ACCOUNT_PURGE_ATTEMPTS; attempt += 1) {
    try {
      purgeAccountRowsOnce(memoryRows, memoryTombstones, storageProvider, userId);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Web offline account purge failed.");
}

function purgeAccountRowsOnce(
  memoryRows: AccountPurgerOptions["memoryRows"],
  memoryTombstones: AccountPurgerOptions["memoryTombstones"],
  storageProvider: AccountPurgerOptions["storageProvider"],
  userId: string,
) {
  memoryTombstones.add(userId);
  memoryRows.delete(userId);
  const storage = storageProvider();
  if (!storage) throw new Error("Persistent web storage is unavailable for account purge verification.");
  const accountKey = webOutboxStorageKey(userId);
  const tombstoneKey = webOutboxDeletionTombstoneKey(userId);
  const corruptPrefix = `${accountKey}.corrupt.`;
  storage.setItem(tombstoneKey, TOMBSTONE_VALUE);
  for (const key of listStorageKeys(storage).filter((item) => item.startsWith(corruptPrefix))) storage.removeItem(key);
  storage.removeItem(accountKey);
  storage.removeItem(LEGACY_WEB_OUTBOX_KEY);
  if (memoryRows.has(userId)
    || storage.getItem(tombstoneKey) !== TOMBSTONE_VALUE
    || storage.getItem(accountKey) !== null
    || storage.getItem(LEGACY_WEB_OUTBOX_KEY) !== null
    || listStorageKeys(storage).some((key) => key.startsWith(corruptPrefix))) {
    throw new Error("Web offline account purge could not be verified.");
  }
}

function listStorageKeys(storage: WebStorageLike) {
  if (typeof storage.length !== "number" || typeof storage.key !== "function") return [];
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

function assertExplicitUserId(userId: string): asserts userId is string {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new TypeError("An explicit account user ID is required to purge offline mutations.");
  }
}
