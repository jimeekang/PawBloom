import type { OfflineMutation } from "../domain/offlineMutation";
import { createNativeOutboxStore } from "./offlineOutbox";

type Row = {
  user_id: string;
  id: string;
  client_mutation_id: string;
  payload: string;
  created_at: string;
  attempts: number;
  status: "pending" | "conflict";
  last_error?: string;
};

async function runNativeOutboxTests() {
  const database = new FakeDatabase();
  let userId: string | null = "user-a";
  const store = createNativeOutboxStore({
    databaseProvider: () => database,
    userIdProvider: async () => userId,
    now: () => "2026-07-12T01:00:00.000Z",
  });

  await store.initializeOutbox();
  assert(database.schema.includes("sync_outbox_v2"), "native outbox must use a new account-scoped table");
  assert(database.schema.includes("primary key (user_id, id)"), "native row identity must include its owner");
  assert(database.schema.includes("unique (user_id, client_mutation_id)"), "idempotency must be scoped by owner");
  assert(database.schema.includes("sync_deleted_accounts_v1"), "native account deletion tombstones must survive app restarts");
  assert(database.legacyDropped, "unowned legacy rows must be discarded rather than replayed");

  const original = mutation("shared", { nested: { value: "original" } });
  await store.enqueueOfflineMutation(original);
  (original.payload.nested as { value: string }).value = "caller-mutated";
  let pending = await store.listPendingMutations();
  assert(pending.length === 1 && pending[0]?.queuedByUserId === "user-a", "listed rows must carry a store-owned replay lease");
  assert((pending[0]?.payload.nested as { value: string }).value === "original", "enqueue must serialize a deep snapshot");
  (pending[0]!.payload.nested as { value: string }).value = "result-mutated";
  assert(((await store.listPendingMutations())[0]?.payload.nested as { value: string }).value === "original", "listed payloads must not alias storage");

  userId = "user-b";
  assert((await store.listPendingMutations()).length === 0, "one account must not read another account's rows");
  await store.enqueueOfflineMutation(mutation("shared"));
  assert((await store.listPendingMutations()).length === 1, "different accounts may safely use the same mutation id");
  assert(!await store.ownsMutationForCurrentUser(pending[0]!), "an account switch must invalidate the old replay lease");
  await store.markMutationApplied(pending[0]!.id, pending[0]!.queuedByUserId);
  userId = "user-a";
  assert((await store.listPendingMutations()).length === 1, "a switched account must not acknowledge the old account's row");

  userId = null;
  await store.enqueueOfflineMutation(mutation("signed-out"));
  userId = "user-a";
  assert(!(await store.listPendingMutations()).some((row) => row.id === "offline-signed-out"), "signed-out writes must be ignored");

  const row = (await store.listPendingMutations())[0]!;
  await store.markMutationRetry(row.id, "offline", row.queuedByUserId);
  assert((await store.listPendingMutations())[0]?.attempts === 1, "retry must increment the pending row only");
  await store.markMutationConflict(row.id, "changed", row.queuedByUserId);
  await store.markMutationRetry(row.id, "still offline", row.queuedByUserId);
  assert((await store.listPendingMutations()).length === 0, "retry must not revive a conflicted row");
  assert(await store.countConflictedMutations() === 1, "native conflict count must include only the signed-in user's parked rows");
  const conflicts = await store.listConflictedMutations();
  assert(conflicts[0]?.mutation?.id === row.id && conflicts[0]?.mutation?.queuedByUserId === "user-a", "native conflict details must retain mutation metadata and an account lease");
  userId = "user-b";
  assert(await store.countConflictedMutations() === 0, "native conflict count must not expose another account's rows");
  assert((await store.listConflictedMutations()).length === 0, "native conflict details must not expose another account's rows");
  await store.clearConflictedMutations();
  assert((await store.listPendingMutations()).length === 1, "clearing conflicts must preserve the current account's pending work");
  userId = "user-a";
  assert(await store.countConflictedMutations() === 1, "another account must not clear the owner's parked conflicts");
  await store.clearConflictedMutations("user-a");
  assert(await store.countConflictedMutations() === 0, "reviewed native conflicts must be removable for the current account");

  database.rows.push({
    user_id: "user-a",
    id: "malformed",
    client_mutation_id: "malformed",
    payload: "{not-json",
    created_at: "2026-07-12T00:00:00.000Z",
    attempts: 0,
    status: "pending",
  });
  assert((await store.listPendingMutations()).length === 0, "malformed native rows must never be replayed");
  assert(database.rows.find((item) => item.id === "malformed")?.status === "conflict", "malformed rows must be quarantined");
  assert((await store.listConflictedMutations()).some((item) => item.id === "malformed" && item.mutation === null), "malformed conflicts must remain visible as unknown review items");

  await createNativeOutboxStore({ databaseProvider: () => database, userIdProvider: async () => userId })
    .enqueueOfflineMutation(mutation("auth-race"));
  database.afterNextRead = () => { userId = "user-b"; };
  const raceStore = createNativeOutboxStore({ databaseProvider: () => database, userIdProvider: async () => userId });
  userId = "user-a";
  assert((await raceStore.listPendingMutations()).length === 0, "auth must be revalidated after the SQLite read");
  userId = "user-a";
  database.afterNextRead = () => { userId = "user-b"; };
  assert(await raceStore.countConflictedMutations() === 0, "a conflict count read must be discarded when the account changes");

  const purgeDatabase = new FakeDatabase();
  let purgeCurrentUser: string | null = "user-a";
  const purgeStore = createNativeOutboxStore({
    databaseProvider: () => purgeDatabase,
    userIdProvider: async () => purgeCurrentUser,
  });
  const pendingToPurge = mutation("purge-pending");
  const conflictToPurge = mutation("purge-conflict");
  await purgeStore.enqueueOfflineMutation(pendingToPurge);
  await purgeStore.enqueueOfflineMutation(conflictToPurge);
  await purgeStore.markMutationConflict(conflictToPurge.id, "reviewed", "user-a");
  purgeCurrentUser = "user-b";
  await purgeStore.enqueueOfflineMutation(mutation("purge-other-user"));
  purgeCurrentUser = null;
  assert(purgeDatabase.rows.filter((item) => item.user_id === "user-a").length === 2,
    "ordinary sign-out must retain the account's pending and conflicted native rows");
  purgeDatabase.failAccountDeletesRemaining = 1;
  await purgeStore.purgeOfflineMutationsForAccount("user-a");
  assert(purgeDatabase.accountDeleteAttempts === 2,
    "authoritative account deletion must retry and verify a transient native purge failure");
  assert(purgeDatabase.tombstones.has("user-a"),
    "authoritative account deletion must durably tombstone the explicit account before removing rows");
  assert(!purgeDatabase.rows.some((item) => item.user_id === "user-a"),
    "authoritative account deletion must purge every native status for the explicit account");
  assert(purgeDatabase.rows.some((item) => item.user_id === "user-b" && item.id === "offline-purge-other-user"),
    "authoritative account deletion must preserve every other account's native rows");
  purgeCurrentUser = "user-a";
  await purgeStore.enqueueOfflineMutation(mutation("deleted-account-enqueue"));
  assert((await purgeStore.listPendingMutations()).length === 0,
    "a tombstoned native account must never enqueue or replay offline mutations");
  purgeDatabase.rows.push({
    user_id: "user-a", id: "interrupted-purge", client_mutation_id: "interrupted-purge",
    payload: JSON.stringify(mutation("interrupted-purge")), created_at: "2026-07-12T00:00:00.000Z",
    attempts: 0, status: "pending",
  });
  await createNativeOutboxStore({ databaseProvider: () => purgeDatabase, userIdProvider: async () => "user-a" }).initializeOutbox();
  assert(!purgeDatabase.rows.some((item) => item.user_id === "user-a"),
    "native initialization must retry physical cleanup for a durable deletion tombstone");
}

class FakeDatabase {
  rows: Row[] = [];
  tombstones = new Set<string>();
  schema = "";
  legacyDropped = false;
  failAccountDeletesRemaining = 0;
  accountDeleteAttempts = 0;
  afterNextRead?: () => void;

  async execAsync(sql: string) {
    this.schema += sql;
    if (sql.includes("drop table if exists sync_outbox;")) this.legacyDropped = true;
    if (sql.includes("where user_id in (select user_id from sync_deleted_accounts_v1)")) {
      this.rows = this.rows.filter((row) => !this.tombstones.has(row.user_id));
    }
  }

  async runAsync(sql: string, ...params: unknown[]) {
    if (sql.includes("insert or ignore into sync_deleted_accounts_v1")) {
      this.tombstones.add(params[0] as string);
    } else if (sql.includes("insert or ignore")) {
      const [userId, id, clientMutationId, payload, createdAt, attempts] = params as [string, string, string, string, string, number];
      if (!this.tombstones.has(userId)
        && !this.rows.some((row) => row.user_id === userId && (row.id === id || row.client_mutation_id === clientMutationId))) {
        this.rows.push({ user_id: userId, id, client_mutation_id: clientMutationId, payload, created_at: createdAt, attempts, status: "pending" });
      }
    } else if (sql.includes("delete from")) {
      const [userId, id] = params as [string, string?];
      if (params.length === 1) {
        this.accountDeleteAttempts += 1;
        if (this.failAccountDeletesRemaining > 0) {
          this.failAccountDeletesRemaining -= 1;
          throw new Error("transient delete failure");
        }
      }
      this.rows = sql.includes("status = 'conflict'")
        ? this.rows.filter((row) => row.user_id !== userId || row.status !== "conflict")
        : params.length === 1
          ? this.rows.filter((row) => row.user_id !== userId)
          : this.rows.filter((row) => row.user_id !== userId || row.id !== id);
    } else if (sql.includes("Malformed offline mutation payload")) {
      const [, userId, id] = params as [string, string, string];
      this.updatePending(userId, id, "Malformed offline mutation payload", true);
    } else {
      const [reason, , userId, id] = params as [string, string, string, string];
      this.updatePending(userId, id, reason, sql.includes("status = 'conflict'"));
    }
    return {} as never;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const [userId, id] = params as [string, string?];
    if (sql.includes("select 1 as present from sync_deleted_accounts_v1")) {
      return this.tombstones.has(userId) ? [{ present: 1 } as T] : [];
    }
    if (sql.includes("count(*)")) {
      const count = sql.includes("status = 'conflict'")
        ? this.rows.filter((row) => row.user_id === userId && row.status === "conflict").length
        : this.rows.filter((row) => row.user_id === userId).length;
      this.afterNextRead?.();
      this.afterNextRead = undefined;
      return [{ count } as T];
    }
    const status = sql.includes("status = 'conflict'") ? "conflict" : "pending";
    if (sql.includes("not exists") && this.tombstones.has(userId)) return [];
    const expectedId = sql.includes("and id = ?") ? id : undefined;
    const rows = this.rows
      .filter((row) => row.user_id === userId && row.status === status && (!expectedId || row.id === expectedId))
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
    this.afterNextRead?.();
    this.afterNextRead = undefined;
    if (sql.startsWith("select id from")) return rows.map((row) => ({ id: row.id }) as T);
    return rows.map((row) => ({ id: row.id, user_id: row.user_id, payload: row.payload, created_at: row.created_at, attempts: row.attempts }) as T);
  }

  private updatePending(userId: string, id: string, reason: string, conflict: boolean) {
    const row = this.rows.find((item) => item.user_id === userId && item.id === id && item.status === "pending");
    if (!row) return;
    row.attempts += 1;
    row.last_error = reason;
    if (conflict) row.status = "conflict";
  }
}

function mutation(name: string, payload: Record<string, unknown> = { name }): OfflineMutation {
  return {
    id: `offline-${name}`,
    clientMutationId: `client-${name}`,
    aggregate: "diary",
    operation: "insert",
    payload,
    createdAt: "2026-07-12T00:00:00.000Z",
    attempts: 0,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export default runNativeOutboxTests();
