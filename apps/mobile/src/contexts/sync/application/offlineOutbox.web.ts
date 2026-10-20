import type { StoredOfflineConflict } from "../domain/offlineConflict";
import type { OfflineMutation } from "../domain/offlineMutation";
import {
  LEGACY_WEB_OUTBOX_KEY,
  WebOutboxLockUnavailableError,
  createWebOutboxAccountBoundary,
  webOutboxDeletionTombstoneKey,
  webOutboxStorageKey,
  type WebOutboxLockProvider,
  type WebStorageLike,
} from "./offlineOutboxAccountPurge.web";
import { cloneOutboxValue, isOfflineMutation, withoutQueuedOwner } from "./offlineOutboxSerialization";
import { runWithOfflineReplayLease } from "./offlineReplayBarrier";
import { browserOutboxLock, browserOutboxStorage, currentWebOutboxUserId } from "./webOfflineOutboxRuntime.web";
const LOCK_PREFIX = "pawbloom.sync_outbox.lock";
export {
  LEGACY_WEB_OUTBOX_KEY,
  WebOutboxLockUnavailableError,
  webOutboxDeletionTombstoneKey,
  webOutboxStorageKey,
  type WebOutboxLockProvider,
  type WebStorageLike,
} from "./offlineOutboxAccountPurge.web";
type OutboxStatus = "pending" | "conflict";
type PersistedOutboxRow = { mutation: OfflineMutation; attempts: number; status: OutboxStatus; lastError?: string; updatedAt: string };
type WebOutboxOptions = {
  storageProvider?: () => WebStorageLike | null;
  userIdProvider?: () => Promise<string | null>;
  lockProvider?: WebOutboxLockProvider;
  now?: () => number;
};
export function createWebOutboxStore({
  storageProvider = browserOutboxStorage,
  userIdProvider = currentWebOutboxUserId,
  lockProvider = browserOutboxLock,
  now = Date.now,
}: WebOutboxOptions = {}) {
  const memoryRows = new Map<string, PersistedOutboxRow[]>();
  const memoryTombstones = new Set<string>();
  let memoryOnly = false;
  const { isAccountDeletionTombstoned, purgeOfflineMutationsForAccount } = createWebOutboxAccountBoundary({
    memoryRows,
    memoryTombstones,
    storageProvider,
    lockProvider,
  });

  async function initializeOutbox() {
    const userId = await resolveUserId();
    if (!userId) return;
    await withUserLock(userId, () => writeRows(userId, readRows(userId)));
  }
  async function enqueueOfflineMutation(mutation: OfflineMutation) {
    await mutateCurrentRows((rows) => {
      const duplicate = rows.some((row) => row.mutation.id === mutation.id || row.mutation.clientMutationId === mutation.clientMutationId);
      if (duplicate) return rows;
      const storedMutation = withoutQueuedOwner(mutation);
      return [...rows, { mutation: cloneOutboxValue(storedMutation), attempts: storedMutation.attempts, status: "pending", updatedAt: storedMutation.createdAt }];
    });
  }

  async function listPendingMutations() {
    const userId = await resolveUserId();
    if (!userId) return [];
    const pending = await withUserLock(userId, () => readRows(userId)
      .filter((row) => row.status === "pending")
      .sort((left, right) => left.mutation.createdAt.localeCompare(right.mutation.createdAt))
      .map((row) => cloneOutboxValue({ ...row.mutation, attempts: row.attempts, queuedByUserId: userId })));
    return pending ?? [];
  }

  async function countConflictedMutations() {
    const userId = await resolveUserId();
    if (!userId) return 0;
    return await withUserLock(userId, () => readRows(userId).filter((row) => row.status === "conflict").length) ?? 0;
  }
  async function listConflictedMutations(): Promise<StoredOfflineConflict[]> {
    const userId = await resolveUserId();
    if (!userId) return [];
    return await withUserLock(userId, () => readRows(userId).filter((row) => row.status === "conflict").map((row) => (
      { id: row.mutation.id, createdAt: row.mutation.createdAt, mutation: cloneOutboxValue({ ...row.mutation, attempts: row.attempts, queuedByUserId: userId }) }
    ))) ?? [];
  }
  async function clearConflictedMutations(expectedUserId?: string) {
    await mutateCurrentRows((rows) => rows.filter((row) => row.status !== "conflict"), expectedUserId);
  }
  async function markMutationApplied(id: string, expectedUserId?: string) {
    await mutateCurrentRows((rows) => rows.filter((row) => row.mutation.id !== id), expectedUserId);
  }

  async function markMutationConflict(id: string, reason: string, expectedUserId?: string) {
    await mutateCurrentRows((rows) => updateRows(rows, id, reason, "conflict"), expectedUserId);
  }

  async function markMutationRetry(id: string, reason: string, expectedUserId?: string) {
    await mutateCurrentRows((rows) => updateRows(rows, id, reason), expectedUserId);
  }

  async function ownsMutationForCurrentUser(mutation: OfflineMutation) {
    const userId = await resolveUserId();
    if (!userId || mutation.queuedByUserId !== userId) return false;
    const owned = await withUserLock(userId, () => readRows(userId)
      .some((row) => row.status === "pending" && row.mutation.id === mutation.id));
    return owned === true;
  }

  async function runWithMutationReplayLease<T>(mutation: OfflineMutation, task: () => Promise<T>) {
    const userId = mutation.queuedByUserId;
    if (!userId) return { executed: false } as const;
    let enteredLock = false;
    const execute = () => {
      enteredLock = true;
      return runWithOfflineReplayLease(userId, async () => {
        if (!await userStillCurrent(userId) || isAccountDeletionTombstoned(userId)) return false;
        return readRows(userId).some((row) => row.status === "pending" && row.mutation.id === mutation.id);
      }, task);
    };
    if (memoryOnly) return execute();
    try {
      return await lockProvider(`${LOCK_PREFIX}.${encodeURIComponent(userId)}`, execute);
    } catch (error) {
      if (enteredLock || !(error instanceof WebOutboxLockUnavailableError)) throw error;
      memoryOnly = true;
      return execute();
    }
  }

  async function mutateCurrentRows(update: (rows: PersistedOutboxRow[]) => PersistedOutboxRow[], expectedUserId?: string) {
    const userId = await resolveUserId();
    if (!userId || (expectedUserId && expectedUserId !== userId)) return;
    await withUserLock(userId, () => writeRows(userId, update(readRows(userId))));
  }

  async function resolveUserId() {
    discardLegacyData();
    try {
      const userId = await userIdProvider();
      return typeof userId === "string" && userId.length > 0 ? userId : null;
    } catch {
      return null;
    }
  }

  async function withUserLock<T>(userId: string, task: () => T): Promise<T | null> {
    const guardedTask = async () => await userStillCurrent(userId) && !isAccountDeletionTombstoned(userId) ? task() : null;
    if (memoryOnly) return guardedTask();
    try {
      return await lockProvider(`${LOCK_PREFIX}.${encodeURIComponent(userId)}`, guardedTask);
    } catch (error) {
      if (!(error instanceof WebOutboxLockUnavailableError)) throw error;
      memoryOnly = true;
      return guardedTask();
    }
  }

  async function userStillCurrent(expectedUserId: string) {
    try { return await userIdProvider() === expectedUserId; } catch { return false; }
  }

  function readRows(userId: string) {
    if (memoryOnly) return readMemoryRows(userId);
    try {
      const storage = storageProvider();
      if (!storage) return switchToMemory(userId, []);
      const key = webOutboxStorageKey(userId);
      const raw = storage.getItem(key);
      if (raw === null) return [];
      try {
        return parseRows(raw);
      } catch {
        return recoverMalformedRows(storage, key, raw, userId);
      }
    } catch {
      return switchToMemory(userId, []);
    }
  }

  function writeRows(userId: string, rows: PersistedOutboxRow[]) {
    const cloned = cloneOutboxValue(rows);
    if (memoryOnly) return void writeMemoryRows(userId, cloned);
    try {
      const storage = storageProvider();
      if (!storage) return void switchToMemory(userId, cloned);
      storage.setItem(webOutboxStorageKey(userId), JSON.stringify(cloned));
    } catch {
      switchToMemory(userId, cloned);
    }
  }

  function recoverMalformedRows(storage: WebStorageLike, key: string, raw: string, userId: string) {
    try {
      storage.setItem(`${key}.corrupt.${now()}`, raw);
      storage.setItem(key, "[]");
      return [];
    } catch {
      return switchToMemory(userId, []);
    }
  }

  function discardLegacyData() {
    if (memoryOnly) return;
    try {
      storageProvider()?.removeItem(LEGACY_WEB_OUTBOX_KEY);
    } catch {
      // Legacy rows are never read, even when deletion is unavailable.
    }
  }

  function readMemoryRows(userId: string) {
    return cloneOutboxValue(memoryRows.get(userId) ?? []);
  }

  function writeMemoryRows(userId: string, rows: PersistedOutboxRow[]) {
    memoryRows.set(userId, cloneOutboxValue(rows));
  }

  function switchToMemory(userId: string, rows: PersistedOutboxRow[]) {
    memoryOnly = true;
    writeMemoryRows(userId, rows);
    return readMemoryRows(userId);
  }

  return { initializeOutbox, enqueueOfflineMutation, listPendingMutations, countConflictedMutations, listConflictedMutations, clearConflictedMutations, purgeOfflineMutationsForAccount, markMutationApplied, markMutationConflict, markMutationRetry, ownsMutationForCurrentUser, runWithMutationReplayLease };
}

const webOutbox = createWebOutboxStore();
export const { initializeOutbox, enqueueOfflineMutation, listPendingMutations, countConflictedMutations, listConflictedMutations, clearConflictedMutations, purgeOfflineMutationsForAccount, markMutationApplied, markMutationConflict, markMutationRetry } = webOutbox;
export const offlineOutboxStore = {
  listPendingMutations,
  countConflictedMutations,
  listConflictedMutations,
  clearConflictedMutations,
  purgeOfflineMutationsForAccount,
  markMutationApplied,
  markMutationConflict,
  markMutationRetry,
  ownsMutationForCurrentUser: webOutbox.ownsMutationForCurrentUser,
  runWithMutationReplayLease: webOutbox.runWithMutationReplayLease,
};

function updateRows(rows: PersistedOutboxRow[], id: string, reason: string, nextStatus?: OutboxStatus) {
  const updatedAt = new Date().toISOString();
  return rows.map((row) => row.mutation.id === id
    ? { ...row, status: nextStatus ?? row.status, attempts: row.attempts + 1, lastError: reason, updatedAt }
    : row);
}

function parseRows(value: string): PersistedOutboxRow[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isPersistedOutboxRow)) throw new Error("Malformed web outbox data.");
  return cloneOutboxValue(parsed);
}

function isPersistedOutboxRow(value: unknown): value is PersistedOutboxRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PersistedOutboxRow>;
  return (row.status === "pending" || row.status === "conflict") && Number.isInteger(row.attempts)
    && typeof row.updatedAt === "string" && isOfflineMutation(row.mutation);
}
