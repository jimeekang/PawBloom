import { strict as assert } from "node:assert";
import type { AccountDeletionStorageClient } from "../functions/delete-account/storage.ts";

const Module = require("node:module");
const originalLoad = Module._load;
const runtime = globalThis as typeof globalThis & { Deno?: unknown };
const originalDeno = runtime.Deno;
const originalLog = console.log;
const originalInfo = console.info;
const originalDebug = console.debug;
const originalWarn = console.warn;
const originalError = console.error;
const logs: string[] = [];
const userId = "b03063a9-aacf-4b3e-a006-57846d1636fd";
const privatePath = "PRIVATE_CANARY_RESOURCE_PATH";
const privateError = "PRIVATE_CANARY_ERROR";
const job = { user_id: userId, job_id: "f02063a9-aacf-4b3e-a006-57846d1636fd", status: "auth_deleted", owned_pet_ids: ["d02063a9-aacf-4b3e-a006-57846d1636fd"], updated_at: "2026-10-31T00:00:00Z" };
let expectedSecret: string | undefined = "unit-only-worker-credential";
let handler!: (request: Request) => Promise<Response>;
let client: AccountDeletionStorageClient;
type Failure = "expiry_rpc" | "list_rpc" | "invalid_inventory" | "unknown_bucket" | "healthy" | "owned_state" | "owned_storage" | "row_storage" | "inner_list_rpc" | "inner_storage" | "inner_and_account";
function mockClient(mode: Failure) {
  const calls: string[] = [];
  let acknowledged = false;
  let inventoryCalls = 0;
  const fixture = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "expire_memory_drafts_v1" && mode === "expiry_rpc") return { data: null, error: new Error(`${privateError}:${privatePath}:${userId}`) };
      if (name === "list_pending_resource_cleanup_v1") {
        inventoryCalls++;
        if ((mode === "inner_list_rpc" || mode === "inner_and_account") && inventoryCalls === 2) return { data: null, error: new Error(`${privateError}:${privatePath}:${userId}`) };
        if (mode === "inner_storage" && inventoryCalls === 1) return { data: [], error: null };
        if (mode === "list_rpc") return { data: null, error: new Error(`${privateError}:${privatePath}:${userId}`) };
        if (mode === "invalid_inventory") return { data: { [privateError]: privatePath }, error: null };
        return { data: acknowledged ? [] : [{ bucket_id: mode === "unknown_bucket" ? "PRIVATE_POISON_BUCKET" : "pet-avatars", storage_path: privatePath }], error: null };
      }
      if (name === "list_pending_account_deletion_jobs_v1") return { data: [job], error: null };
      if (name === "claim_account_deletion_operation_v1") return { data: true, error: null };
      if (name === "get_account_deletion_job_v1") return { data: job, error: null };
      if (name === "list_account_deletion_objects_v1" || name === "list_account_deletion_temporary_objects_v1") return { data: [], error: null };
      if (name === "account_deletion_storage_state_v1") return { data: { registered_user_owned_count: 0, user_owned_count: mode === "owned_state" ? 1 : 0, owned_pet_object_count: 0, temporary_object_count: 0 }, error: null };
      if (name === "complete_account_deletion_v1" && mode === "inner_and_account") return { data: null, error: new Error(`${privateError}:${privatePath}:${userId}`) };
      if (name === "complete_resource_cleanup_v1") { assert.equal(args.p_storage_path, privatePath); acknowledged = true; }
      return { data: null, error: null };
    },
    storage: { from: (bucket: string) => ({
      remove: async (paths: string[]) => { calls.push(`remove:${bucket}`); assert.deepEqual(paths, [privatePath]); return { error: mode === "row_storage" || mode === "inner_storage" ? new Error(`${privateError}:${privatePath}:${userId}`) : null }; },
      copy: async () => ({ error: null }),
      list: async () => ({ data: [], error: mode === "owned_storage" ? new Error("Account-owned storage unavailable") : null }),
    }) },
  } satisfies AccountDeletionStorageClient;
  return { fixture, calls };
}
function workerRequest(body: unknown = {}, secret = "unit-only-worker-credential") {
  return new Request("http://unit.test/delete-account", { method: "POST", headers: { "x-pawbloom-account-deletion-worker": secret, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function testRoute() {
  const entry = require.resolve("../functions/delete-account/index.ts");
  try {
    runtime.Deno = { env: { get: (name: string) => name === "ACCOUNT_DELETION_WORKER_SECRET" ? expectedSecret : undefined }, serve: (callback: typeof handler) => { handler = callback; } };
    const capture = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
    console.log = console.info = console.debug = console.warn = console.error = capture;
    Module._load = function(this: unknown, request: string, parent: { filename?: string }, ...rest: unknown[]) {
      if (request === "../_shared/supabase.ts" && parent?.filename === entry) return { serviceClient: () => client, requireUser: async () => { throw new Error("Worker must not invoke user auth"); } };
      return originalLoad.call(this, request, parent, ...rest);
    };
    delete require.cache[entry];
    require(entry);
    const resourceCases = [
      { mode: "expiry_rpc", completed: 0, failed: 2, removes: 0, acks: 0, warnings: 2 },
      { mode: "list_rpc", completed: 0, failed: 2, removes: 0, acks: 0, warnings: 2 },
      { mode: "invalid_inventory", completed: 0, failed: 2, removes: 0, acks: 0, warnings: 2 },
      { mode: "unknown_bucket", completed: 0, failed: 2, removes: 0, acks: 0, warnings: 2 },
      { mode: "healthy", completed: 1, failed: 0, removes: 1, acks: 1, warnings: 0 },
      { mode: "row_storage", completed: 0, failed: 2, removes: 2, acks: 0, warnings: 2 },
      { mode: "inner_list_rpc", completed: 1, failed: 1, removes: 1, acks: 1, warnings: 1 },
      { mode: "inner_storage", completed: 0, failed: 1, removes: 1, acks: 0, warnings: 1 },
      { mode: "inner_and_account", completed: 1, failed: 1, removes: 1, acks: 1, warnings: 1 },
    ] as const;
    for (const expected of resourceCases) {
      const { mode } = expected;
      const current = mockClient(mode); client = current.fixture; logs.length = 0;
      const response = await handler(workerRequest());
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.completed, mode === "inner_and_account" ? 0 : 1, `${mode} blocked account completion`);
      assert.equal(body.failed, mode === "inner_and_account" ? 1 : 0);
      assert.ok(current.calls.includes("complete_account_deletion_v1"));
      if (mode === "inner_and_account") assert.ok(current.calls.includes("record_account_deletion_failure_v1"));
      assert.equal(current.calls.filter((name) => name === "expire_memory_drafts_v1").length, 2, "both the initial and inner drain must be covered");
      assert.ok(current.calls.indexOf("expire_memory_drafts_v1") < current.calls.indexOf("claim_account_deletion_operation_v1"));
      assert.deepEqual(body.resources, { completed: expected.completed, failed: expected.failed, drainFailed: expected.failed > 0 });
      assert.equal(current.calls.filter((name) => name === "remove:pet-avatars").length, expected.removes);
      assert.equal(current.calls.filter((name) => name === "complete_resource_cleanup_v1").length, expected.acks);
      assert.deepEqual(logs, Array(expected.warnings).fill("Supplemental resource cleanup deferred"));
      const visible = JSON.stringify(body) + logs.join(" ");
      for (const canary of [privateError, privatePath, userId, "PRIVATE_POISON_BUCKET"]) assert.equal(visible.includes(canary), false, "resource details leaked through logs/response");
    }
    // These are the account's own safety checks, so their failure must still prevent completion.
    for (const mode of ["owned_state", "owned_storage"] as const) {
      const current = mockClient(mode); client = current.fixture;
      const response = await handler(workerRequest()); const body = await response.json();
      assert.equal(body.completed, 0); assert.equal(body.failed, 1);
      assert.equal(current.calls.includes("complete_account_deletion_v1"), false);
      assert.ok(current.calls.includes("record_account_deletion_failure_v1"));
    }
    for (const invalid of ["bad_secret", "missing_config", "bad_body", "null_body"] as const) {
      const current = mockClient("healthy"); client = current.fixture;
      expectedSecret = invalid === "missing_config" ? undefined : "unit-only-worker-credential";
      const response = await handler(workerRequest(invalid === "bad_body" ? { target_user_id: "invalid" } : invalid === "null_body" ? null : {}, invalid === "bad_secret" ? "wrong" : "unit-only-worker-credential"));
      assert.equal(response.status, invalid === "bad_secret" || invalid === "missing_config" ? 401 : 400);
      assert.deepEqual(current.calls, [], "request validation must precede resource/account work");
    }
  } finally {
    Module._load = originalLoad;
    console.log = originalLog;
    console.info = originalInfo;
    console.debug = originalDebug;
    console.warn = originalWarn;
    console.error = originalError;
    if (originalDeno === undefined) delete runtime.Deno; else runtime.Deno = originalDeno;
    delete require.cache[entry];
  }
  console.log("Actual account worker route: both supplemental drains isolated, strict validation retained, account guards/auth and privacy verified.");
}
export default testRoute();
