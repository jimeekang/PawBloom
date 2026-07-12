import { supabase } from "../../../shared-kernel/supabase/client";
import type { OfflineMutation } from "../domain/offlineMutation";

export const LEGACY_WEB_OUTBOX_KEY = "pawbloom.sync_outbox.v1";
const STORAGE_PREFIX = "pawbloom.sync_outbox.v2";
const LOCK_PREFIX = "pawbloom.sync_outbox.lock";

type OutboxStatus = "pending" | "conflict";
type PersistedOutboxRow = {
  mutation: OfflineMutation;
  attempts: number;
  status: OutboxStatus;
  lastError?: string;
  updatedAt: string;
};

export type WebStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type WebOutboxLockProvider = <T>(name: string, task: () => T | Promise<T>) => Promise<T>;

export class WebOutboxLockUnavailableError extends Error {
  constructor() {
    super("A cross-tab outbox lock is unavailable.");
    this.name = "WebOutboxLockUnavailableError";
  }
}

type WebOutboxOptions = {
  storageProvider?: () => WebStorageLike | null;
  userIdProvider?: () => Promise<string | null>;
  lockProvider?: WebOutboxLockProvider;
  now?: () => number;
};

export function webOutboxStorageKey(userId: string) {
  return `${STORAGE_PREFIX}.${encodeURIComponent(userId)}`;
}

export function createWebOutboxStore({
  storageProvider = browserStorage,
  userIdProvider = currentAuthUserId,
  lockProvider = browserLock,
  now = Date.now,
}: WebOutboxOptions = {}) {
  const memoryRows = new Map<string, PersistedOutboxRow[]>();
  let memoryOnly = false;

  async function initializeOutbox() {
    const userId = await resolveUserId();
    if (!userId) return;
    await withUserLock(userId, () => writeRows(userId, readRows(userId)));
  }

  async function enqueueOfflineMutation(mutation: OfflineMutation) {
    await mutateCurrentRows((rows) => {
      const duplicate = rows.some((row) => row.mutation.id === mutation.id || row.mutation.clientMutationId === mutation.clientMutationId);
      if (duplicate) return rows;
      return [...rows, { mutation: deepClone(mutation), attempts: mutation.attempts, status: "pending", updatedAt: mutation.createdAt }];
    });
  }

  async function listPendingMutations() {
    const userId = await resolveUserId();
    if (!userId) return [];
    const pending = await withUserLock(userId, () => readRows(userId)
      .filter((row) => row.status === "pending")
      .sort((left, right) => left.mutation.createdAt.localeCompare(right.mutation.createdAt))
      .map((row) => deepClone({ ...row.mutation, attempts: row.attempts })));
    return pending ?? [];
  }

  async function markMutationApplied(id: string) {
    await mutateCurrentRows((rows) => rows.filter((row) => row.mutation.id !== id));
  }

  async function markMutationConflict(id: string, reason: string) {
    await mutateCurrentRows((rows) => updateRows(rows, id, reason, "conflict"));
  }

  async function markMutationRetry(id: string, reason: string) {
    await mutateCurrentRows((rows) => updateRows(rows, id, reason));
  }

  async function mutateCurrentRows(update: (rows: PersistedOutboxRow[]) => PersistedOutboxRow[]) {
    const userId = await resolveUserId();
    if (!userId) return;
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
    const guardedTask = async () => await userStillCurrent(userId) ? task() : null;
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
    const cloned = deepClone(rows);
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
    return deepClone(memoryRows.get(userId) ?? []);
  }

  function writeMemoryRows(userId: string, rows: PersistedOutboxRow[]) {
    memoryRows.set(userId, deepClone(rows));
  }

  function switchToMemory(userId: string, rows: PersistedOutboxRow[]) {
    memoryOnly = true;
    writeMemoryRows(userId, rows);
    return readMemoryRows(userId);
  }

  return { initializeOutbox, enqueueOfflineMutation, listPendingMutations, markMutationApplied, markMutationConflict, markMutationRetry };
}

const webOutbox = createWebOutboxStore();
export const initializeOutbox = webOutbox.initializeOutbox;
export const enqueueOfflineMutation = webOutbox.enqueueOfflineMutation;
export const listPendingMutations = webOutbox.listPendingMutations;
export const markMutationApplied = webOutbox.markMutationApplied;
export const markMutationConflict = webOutbox.markMutationConflict;
export const markMutationRetry = webOutbox.markMutationRetry;
export const offlineOutboxStore = { listPendingMutations, markMutationApplied, markMutationConflict, markMutationRetry };

function updateRows(rows: PersistedOutboxRow[], id: string, reason: string, nextStatus?: OutboxStatus) {
  const updatedAt = new Date().toISOString();
  return rows.map((row) => row.mutation.id === id
    ? { ...row, status: nextStatus ?? row.status, attempts: row.attempts + 1, lastError: reason, updatedAt }
    : row);
}

async function currentAuthUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  return error ? null : data.session?.user.id ?? null;
}

function browserStorage(): WebStorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

async function browserLock<T>(name: string, task: () => T | Promise<T>) {
  const locks = (globalThis.navigator as typeof globalThis.navigator & { locks?: { request: WebOutboxLockProvider } } | undefined)?.locks;
  if (!locks?.request) throw new WebOutboxLockUnavailableError();
  try {
    return await locks.request(name, task);
  } catch (error) {
    if (typeof DOMException !== "undefined" && error instanceof DOMException
      && (error.name === "NotSupportedError" || error.name === "SecurityError")) throw new WebOutboxLockUnavailableError();
    throw error;
  }
}

function parseRows(value: string): PersistedOutboxRow[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isPersistedOutboxRow)) throw new Error("Malformed web outbox data.");
  return deepClone(parsed);
}

function isPersistedOutboxRow(value: unknown): value is PersistedOutboxRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PersistedOutboxRow>;
  return (row.status === "pending" || row.status === "conflict") && Number.isInteger(row.attempts)
    && typeof row.updatedAt === "string" && isOfflineMutation(row.mutation);
}

function isOfflineMutation(value: unknown): value is OfflineMutation {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Partial<OfflineMutation>;
  return typeof mutation.id === "string" && typeof mutation.clientMutationId === "string" && typeof mutation.aggregate === "string"
    && (mutation.operation === "insert" || mutation.operation === "update" || mutation.operation === "delete")
    && Boolean(mutation.payload && typeof mutation.payload === "object" && !Array.isArray(mutation.payload))
    && typeof mutation.createdAt === "string" && Number.isInteger(mutation.attempts);
}

function deepClone<T>(value: T): T {
  try { if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value); } catch { /* JSON fallback */ }
  return JSON.parse(JSON.stringify(value)) as T;
}
