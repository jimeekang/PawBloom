import type { StoredOfflineConflict } from "../domain/offlineConflict";
import type { OfflineMutation } from "../domain/offlineMutation";
import {
  NATIVE_DELETED_ACCOUNTS_TABLE,
  NATIVE_OUTBOX_TABLE,
  initializeNativeOutboxDatabase,
  purgeNativeOfflineMutationsForAccount,
  type NativeOutboxDatabase,
  type NativeOutboxRow,
} from "./nativeOfflineOutboxDatabase";
import { currentNativeOutboxUserId, nativeOutboxDatabase } from "./nativeOfflineOutboxRuntime";
import { parseStoredOfflineMutation, withoutQueuedOwner } from "./offlineOutboxSerialization";
import { runWithOfflineReplayLease } from "./offlineReplayBarrier";
export type { NativeOutboxDatabase } from "./nativeOfflineOutboxDatabase";
type NativeOutboxOptions = {
  databaseProvider?: () => NativeOutboxDatabase;
  userIdProvider?: () => Promise<string | null>;
  now?: () => string;
};
export function createNativeOutboxStore({
  databaseProvider = nativeOutboxDatabase,
  userIdProvider = currentNativeOutboxUserId,
  now = () => new Date().toISOString(),
}: NativeOutboxOptions = {}) {
  let initialization: Promise<void> | null = null;
  function initializeOutbox() {
    initialization ??= initializeDatabase().catch((error) => {
      initialization = null;
      throw error;
    });
    return initialization;
  }

  async function initializeDatabase() {
    await initializeNativeOutboxDatabase(databaseProvider());
  }
  async function enqueueOfflineMutation(mutation: OfflineMutation) {
    const userId = await resolveUserId();
    if (!userId) return;
    await initializeOutbox();
    if (!await userStillCurrent(userId)) return;
    const storedMutation = withoutQueuedOwner(mutation);
    await databaseProvider().runAsync(
      `insert or ignore into ${NATIVE_OUTBOX_TABLE}
       (user_id, id, client_mutation_id, payload, created_at, attempts)
       select ?, ?, ?, ?, ?, ?
       where not exists (
         select 1 from ${NATIVE_DELETED_ACCOUNTS_TABLE} where user_id = ?
       )`,
      userId,
      storedMutation.id,
      storedMutation.clientMutationId,
      JSON.stringify(storedMutation),
      storedMutation.createdAt,
      storedMutation.attempts,
      userId,
    );
  }
  async function listPendingMutations() {
    const userId = await resolveUserId();
    if (!userId) return [];
    await initializeOutbox();
    const rows = await databaseProvider().getAllAsync<NativeOutboxRow>(
      `select id, user_id, payload, attempts from ${NATIVE_OUTBOX_TABLE}
       where user_id = ? and status = 'pending'
         and not exists (
           select 1 from ${NATIVE_DELETED_ACCOUNTS_TABLE} where user_id = ?
         )
       order by created_at asc`,
      userId,
      userId,
    );
    if (!await userStillCurrent(userId)) return [];

    const mutations: OfflineMutation[] = [];
    for (const row of rows) {
      const mutation = parseStoredOfflineMutation(row.payload);
      if (!mutation) {
        await quarantineMalformedRow(row, userId);
        continue;
      }
      mutations.push({ ...mutation, attempts: row.attempts, queuedByUserId: row.user_id });
    }
    return mutations;
  }

  async function countConflictedMutations() {
    const userId = await resolveUserId();
    if (!userId) return 0;
    await initializeOutbox();
    const rows = await databaseProvider().getAllAsync<{ count: number }>(
      `select count(*) as count from ${NATIVE_OUTBOX_TABLE}
       where user_id = ? and status = 'conflict'
         and not exists (
           select 1 from ${NATIVE_DELETED_ACCOUNTS_TABLE} where user_id = ?
         )`,
      userId,
      userId,
    );
    return await userStillCurrent(userId) ? rows[0]?.count ?? 0 : 0;
  }

  async function listConflictedMutations(): Promise<StoredOfflineConflict[]> {
    const userId = await resolveUserId();
    if (!userId) return [];
    await initializeOutbox();
    const rows = await databaseProvider().getAllAsync<NativeOutboxRow>(
      `select id, user_id, payload, created_at, attempts from ${NATIVE_OUTBOX_TABLE}
       where user_id = ? and status = 'conflict'
         and not exists (
           select 1 from ${NATIVE_DELETED_ACCOUNTS_TABLE} where user_id = ?
         )
       order by created_at asc`,
      userId,
      userId,
    );
    if (!await userStillCurrent(userId)) return [];
    return rows.map((row) => {
      const mutation = parseStoredOfflineMutation(row.payload);
      return { id: row.id, createdAt: mutation?.createdAt ?? row.created_at, mutation: mutation ? { ...mutation, attempts: row.attempts, queuedByUserId: row.user_id } : null };
    });
  }

  async function clearConflictedMutations(expectedUserId?: string) {
    await mutateOwnedRow(expectedUserId, async (userId) => {
      await databaseProvider().runAsync(
        `delete from ${NATIVE_OUTBOX_TABLE} where user_id = ? and status = 'conflict'`,
        userId,
      );
    });
  }

  async function purgeOfflineMutationsForAccount(userId: string) {
    await purgeNativeOfflineMutationsForAccount(databaseProvider(), initializeOutbox, userId);
  }

  async function markMutationApplied(id: string, expectedUserId?: string) {
    await mutateOwnedRow(expectedUserId, async (userId) => {
      await databaseProvider().runAsync(
        `delete from ${NATIVE_OUTBOX_TABLE} where user_id = ? and id = ?`,
        userId,
        id,
      );
    });
  }

  async function markMutationConflict(id: string, reason: string, expectedUserId?: string) {
    await mutateOwnedRow(expectedUserId, async (userId) => {
      await databaseProvider().runAsync(
        `update ${NATIVE_OUTBOX_TABLE}
         set status = 'conflict', attempts = attempts + 1, last_error = ?, updated_at = ?
         where user_id = ? and id = ? and status = 'pending'`,
        reason,
        now(),
        userId,
        id,
      );
    });
  }

  async function markMutationRetry(id: string, reason: string, expectedUserId?: string) {
    await mutateOwnedRow(expectedUserId, async (userId) => {
      await databaseProvider().runAsync(
        `update ${NATIVE_OUTBOX_TABLE}
         set attempts = attempts + 1, last_error = ?, updated_at = ?
         where user_id = ? and id = ? and status = 'pending'`,
        reason,
        now(),
        userId,
        id,
      );
    });
  }

  async function ownsMutationForCurrentUser(mutation: OfflineMutation) {
    const expectedUserId = mutation.queuedByUserId;
    if (!expectedUserId || !await userStillCurrent(expectedUserId)) return false;
    await initializeOutbox();
    const rows = await databaseProvider().getAllAsync<{ id: string }>(
      `select id from ${NATIVE_OUTBOX_TABLE}
       where user_id = ? and id = ? and status = 'pending'
         and not exists (
           select 1 from ${NATIVE_DELETED_ACCOUNTS_TABLE} where user_id = ?
         )
       limit 1`,
      expectedUserId,
      mutation.id,
      expectedUserId,
    );
    return rows.length === 1 && await userStillCurrent(expectedUserId);
  }

  async function runWithMutationReplayLease<T>(mutation: OfflineMutation, task: () => Promise<T>) {
    const userId = mutation.queuedByUserId;
    if (!userId) return { executed: false } as const;
    return runWithOfflineReplayLease(userId, () => ownsMutationForCurrentUser(mutation), task);
  }

  async function quarantineMalformedRow(row: NativeOutboxRow, expectedUserId: string) {
    if (!await userStillCurrent(expectedUserId)) return;
    await databaseProvider().runAsync(
      `update ${NATIVE_OUTBOX_TABLE}
       set status = 'conflict', attempts = attempts + 1,
           last_error = 'Malformed offline mutation payload', updated_at = ?
       where user_id = ? and id = ? and status = 'pending'`,
      now(),
      expectedUserId,
      row.id,
    );
  }

  async function mutateOwnedRow(expectedUserId: string | undefined, mutation: (userId: string) => Promise<void>) {
    const currentUserId = await resolveUserId();
    if (!currentUserId || (expectedUserId && expectedUserId !== currentUserId)) return;
    await initializeOutbox();
    if (!await userStillCurrent(currentUserId)) return;
    await mutation(currentUserId);
  }

  async function resolveUserId() {
    try {
      const userId = await userIdProvider();
      return typeof userId === "string" && userId.length > 0 ? userId : null;
    } catch {
      return null;
    }
  }

  async function userStillCurrent(expectedUserId: string) {
    try {
      return await userIdProvider() === expectedUserId;
    } catch {
      return false;
    }
  }

  return { initializeOutbox, enqueueOfflineMutation, listPendingMutations, countConflictedMutations, listConflictedMutations, clearConflictedMutations, purgeOfflineMutationsForAccount, markMutationApplied, markMutationConflict, markMutationRetry, ownsMutationForCurrentUser, runWithMutationReplayLease };
}

const nativeOutbox = createNativeOutboxStore();
export const { initializeOutbox, enqueueOfflineMutation, listPendingMutations, countConflictedMutations, listConflictedMutations, clearConflictedMutations, purgeOfflineMutationsForAccount, markMutationApplied, markMutationConflict, markMutationRetry } = nativeOutbox;
export const offlineOutboxStore = {
  listPendingMutations,
  countConflictedMutations,
  listConflictedMutations,
  clearConflictedMutations,
  purgeOfflineMutationsForAccount,
  markMutationApplied,
  markMutationConflict,
  markMutationRetry,
  ownsMutationForCurrentUser: nativeOutbox.ownsMutationForCurrentUser,
  runWithMutationReplayLease: nativeOutbox.runWithMutationReplayLease,
};
