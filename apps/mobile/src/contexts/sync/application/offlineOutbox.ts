import * as SQLite from "expo-sqlite";
import type { OfflineMutation } from "../domain/offlineMutation";

type OutboxRow = {
  payload: string;
};

let database: SQLite.SQLiteDatabase | null = null;

function db() {
  database ??= SQLite.openDatabaseSync("petbloom_outbox.db");
  return database;
}

export async function initializeOutbox() {
  await db().execAsync(`
    create table if not exists sync_outbox (
      id text primary key,
      client_mutation_id text not null unique,
      payload text not null,
      created_at text not null,
      attempts integer not null default 0
    );
  `);
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
  const rows = await db().getAllAsync<OutboxRow>("select payload from sync_outbox order by created_at asc");
  return rows.map((row) => JSON.parse(row.payload) as OfflineMutation);
}

