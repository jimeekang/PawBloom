import * as SQLite from "expo-sqlite";
import type { OfflineMutation } from "../domain/offlineMutation";

type OutboxRow = {
  payload: string;
  attempts: number;
};

let database: SQLite.SQLiteDatabase | null = null;

function db() {
  database ??= SQLite.openDatabaseSync("pawbloom_outbox.db");
  return database;
}

export async function initializeOutbox() {
  await db().execAsync(`
    create table if not exists sync_outbox (
      id text primary key,
      client_mutation_id text not null unique,
      payload text not null,
      created_at text not null,
      attempts integer not null default 0,
      status text not null default 'pending',
      last_error text,
      updated_at text not null default current_timestamp
    );
  `);
  await addColumnIfMissing("status text not null default 'pending'");
  await addColumnIfMissing("last_error text");
  await addColumnIfMissing("updated_at text not null default current_timestamp");
}

export async function enqueueOfflineMutation(mutation: OfflineMutation) {
  await initializeOutbox();
  await db().runAsync(
    `insert or ignore into sync_outbox (id, client_mutation_id, payload, created_at, attempts)
     values (?, ?, ?, ?, ?)`,
    mutation.id,
    mutation.clientMutationId,
    JSON.stringify(mutation),
    mutation.createdAt,
    mutation.attempts,
  );
}

export async function listPendingMutations() {
  await initializeOutbox();
  const rows = await db().getAllAsync<OutboxRow>("select payload, attempts from sync_outbox where status = 'pending' order by created_at asc");
  return rows.map((row) => ({ ...(JSON.parse(row.payload) as OfflineMutation), attempts: row.attempts }));
}

export async function markMutationApplied(id: string) {
  await initializeOutbox();
  await db().runAsync("delete from sync_outbox where id = ?", id);
}

export async function markMutationConflict(id: string, reason: string) {
  await initializeOutbox();
  await db().runAsync(
    "update sync_outbox set status = 'conflict', attempts = attempts + 1, last_error = ?, updated_at = ? where id = ?",
    reason,
    new Date().toISOString(),
    id,
  );
}

export async function markMutationRetry(id: string, reason: string) {
  await initializeOutbox();
  await db().runAsync(
    "update sync_outbox set attempts = attempts + 1, last_error = ?, updated_at = ? where id = ?",
    reason,
    new Date().toISOString(),
    id,
  );
}

export const offlineOutboxStore = {
  listPendingMutations,
  markMutationApplied,
  markMutationConflict,
  markMutationRetry,
};

async function addColumnIfMissing(definition: string) {
  try {
    await db().execAsync(`alter table sync_outbox add column ${definition};`);
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
}
