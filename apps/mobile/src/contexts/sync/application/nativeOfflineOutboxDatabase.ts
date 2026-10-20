import type * as SQLite from "expo-sqlite";
import { blockOfflineReplayForAccount } from "./offlineReplayBarrier";

export const NATIVE_OUTBOX_TABLE = "sync_outbox_v2";
export const NATIVE_DELETED_ACCOUNTS_TABLE = "sync_deleted_accounts_v1";
const LEGACY_NATIVE_OUTBOX_TABLE = "sync_outbox";
const ACCOUNT_PURGE_ATTEMPTS = 3;

export type NativeOutboxRow = {
  id: string;
  user_id: string;
  payload: string;
  created_at: string;
  attempts: number;
};

export type NativeOutboxDatabase = Pick<SQLite.SQLiteDatabase, "execAsync" | "runAsync" | "getAllAsync">;

export async function initializeNativeOutboxDatabase(database: NativeOutboxDatabase) {
  await database.execAsync(`
    create table if not exists ${NATIVE_DELETED_ACCOUNTS_TABLE} (
      user_id text primary key,
      deleted_at text not null default current_timestamp
    );
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
    delete from ${NATIVE_OUTBOX_TABLE}
      where user_id in (select user_id from ${NATIVE_DELETED_ACCOUNTS_TABLE});
    drop table if exists ${LEGACY_NATIVE_OUTBOX_TABLE};
  `);
}

export async function purgeNativeOfflineMutationsForAccount(
  database: NativeOutboxDatabase,
  initialize: () => Promise<void>,
  userId: string,
) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new TypeError("An explicit account user ID is required to purge offline mutations.");
  }
  // Close the in-process gate synchronously, but do not wait for an active
  // remote handler before making the deletion marker crash-durable.
  const replayDrain = blockOfflineReplayForAccount(userId);
  await initialize();
  let lastError: unknown;
  for (let attempt = 0; attempt < ACCOUNT_PURGE_ATTEMPTS; attempt += 1) {
    try {
      // Persist the deny marker before deleting rows. If row removal is
      // interrupted, enqueue/replay still fail closed and a later attempt can
      // finish the physical purge.
      await database.runAsync(
        `insert or ignore into ${NATIVE_DELETED_ACCOUNTS_TABLE} (user_id) values (?)`,
        userId,
      );
      const tombstone = await database.getAllAsync<{ present: number }>(
        `select 1 as present from ${NATIVE_DELETED_ACCOUNTS_TABLE} where user_id = ? limit 1`,
        userId,
      );
      if (tombstone.length !== 1) throw new Error("Offline account deletion tombstone could not be verified.");
      await replayDrain;
      await database.runAsync(`delete from ${NATIVE_OUTBOX_TABLE} where user_id = ?`, userId);
      const remaining = await database.getAllAsync<{ count: number }>(
        `select count(*) as count from ${NATIVE_OUTBOX_TABLE} where user_id = ?`,
        userId,
      );
      if (tombstone.length === 1 && remaining.length === 1 && remaining[0]?.count === 0) return;
      lastError = new Error("Offline account purge could not be verified.");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Offline account purge failed.");
}
