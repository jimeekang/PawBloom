import * as SQLite from "expo-sqlite";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { OfflineMutation } from "../domain/offlineMutation";
import { parseStoredOfflineMutation, withoutQueuedOwner } from "./offlineOutboxSerialization";

const NATIVE_OUTBOX_TABLE = "sync_outbox_v2";
const LEGACY_NATIVE_OUTBOX_TABLE = "sync_outbox";

type OutboxRow = {
  id: string;
  user_id: string;
  payload: string;
  attempts: number;
};

export type NativeOutboxDatabase = Pick<SQLite.SQLiteDatabase, "execAsync" | "runAsync" | "getAllAsync">;

type NativeOutboxOptions = {
  databaseProvider?: () => NativeOutboxDatabase;
  userIdProvider?: () => Promise<string | null>;
  now?: () => string;
};

let database: SQLite.SQLiteDatabase | null = null;

function db() {
  database ??= SQLite.openDatabaseSync("pawbloom_outbox.db");
  return database;
}

export function createNativeOutboxStore({
  databaseProvider = db,
  userIdProvider = currentAuthUserId,
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
    const database = databaseProvider();
    await database.execAsync(`
      create table if not exists ${NATIVE_OUTBOX_TABLE} (
        user_id text not null,
        id text not null,
        client_mutation_id text not null,
        payload text not null,
        created_at text not null,
        attempts integer not null default 0,
        status text not null default 'pending',
        last_error text,
        updated_at text not null default current_timestamp,
        primary key (user_id, id),
        unique (user_id, client_mutation_id)
      );
      create index if not exists sync_outbox_v2_pending_idx
        on ${NATIVE_OUTBOX_TABLE} (user_id, status, created_at);
      drop table if exists ${LEGACY_NATIVE_OUTBOX_TABLE};
    `);
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
       values (?, ?, ?, ?, ?, ?)`,
      userId,
      storedMutation.id,
      storedMutation.clientMutationId,
      JSON.stringify(storedMutation),
      storedMutation.createdAt,
      storedMutation.attempts,
    );
  }

  async function listPendingMutations() {
    const userId = await resolveUserId();
    if (!userId) return [];
    await initializeOutbox();
    const rows = await databaseProvider().getAllAsync<OutboxRow>(
      `select id, user_id, payload, attempts from ${NATIVE_OUTBOX_TABLE}
       where user_id = ? and status = 'pending' order by created_at asc`,
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
       where user_id = ? and status = 'conflict'`,
      userId,
    );
    return await userStillCurrent(userId) ? rows[0]?.count ?? 0 : 0;
  }

  async function clearConflictedMutations(expectedUserId?: string) {
    await mutateOwnedRow(expectedUserId, async (userId) => {
      await databaseProvider().runAsync(
        `delete from ${NATIVE_OUTBOX_TABLE} where user_id = ? and status = 'conflict'`,
        userId,
      );
    });
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
       where user_id = ? and id = ? and status = 'pending' limit 1`,
      expectedUserId,
      mutation.id,
    );
    return rows.length === 1 && await userStillCurrent(expectedUserId);
  }

  async function quarantineMalformedRow(row: OutboxRow, expectedUserId: string) {
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

  return {
    initializeOutbox,
    enqueueOfflineMutation,
    listPendingMutations,
    countConflictedMutations,
    clearConflictedMutations,
    markMutationApplied,
    markMutationConflict,
    markMutationRetry,
    ownsMutationForCurrentUser,
  };
}

const nativeOutbox = createNativeOutboxStore();
export const initializeOutbox = nativeOutbox.initializeOutbox;
export const enqueueOfflineMutation = nativeOutbox.enqueueOfflineMutation;
export const listPendingMutations = nativeOutbox.listPendingMutations;
export const countConflictedMutations = nativeOutbox.countConflictedMutations;
export const clearConflictedMutations = nativeOutbox.clearConflictedMutations;
export const markMutationApplied = nativeOutbox.markMutationApplied;
export const markMutationConflict = nativeOutbox.markMutationConflict;
export const markMutationRetry = nativeOutbox.markMutationRetry;
export const offlineOutboxStore = {
  listPendingMutations,
  countConflictedMutations,
  clearConflictedMutations,
  markMutationApplied,
  markMutationConflict,
  markMutationRetry,
  ownsMutationForCurrentUser: nativeOutbox.ownsMutationForCurrentUser,
};

async function currentAuthUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  return error ? null : data.session?.user.id ?? null;
}
