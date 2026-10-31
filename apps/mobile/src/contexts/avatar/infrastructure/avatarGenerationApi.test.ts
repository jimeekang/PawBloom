import { AVATAR_AI_CONSENT_VERSION, AVATAR_AI_POLICY_VERSION } from "../domain/avatarGeneration";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
const calls: { name: string; args: any[] }[] = [];
const petId = "10000000-0000-4000-8000-000000000001", avatarId = "10000000-0000-4000-8000-000000000002";
const source = new Uint8Array([1, 2, 3]).buffer;
const client = {
  rpc: async (name: string, args: any) => { calls.push({ name, args: [args] }); return { data: name === "apply_pet_avatar" ? { pet_id: petId, avatar_id: avatarId, applied: true } : {}, error: null }; },
  storage: { from: (bucket: string) => ({ upload: async (...args: unknown[]) => { calls.push({ name: "upload", args: [bucket, ...args] }); return { error: null }; } }) },
  functions: { invoke: async (...args: unknown[]) => { calls.push({ name: "invoke", args }); return { data: { status: "ready" }, error: null }; } },
  from(table: string) {
    calls.push({ name: "from", args: [table] });
    const query: any = {};
    for (const method of ["select", "eq", "gte", "order", "limit"]) query[method] = (...args: unknown[]) => { calls.push({ name: method, args }); return query; };
    query.maybeSingle = async () => ({ data: null, error: null }); return query;
  },
};
modules._load = function (name: string, parent: unknown, main: boolean) {
  return name === "../../../shared-kernel/supabase/client" ? { supabase: client } : original.call(this, name, parent, main);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => ({ ok: true, arrayBuffer: async () => source })) as unknown as typeof fetch;
try {
  const { avatarGenerationApi } = require("./avatarGenerationApi");
  const photo = { uri: "file:///cat.png", contentType: "image/png", byteSize: 3 };
  await avatarGenerationApi.prepare(petId, photo);
  const rpc = calls[0];
  assert(rpc.name === "prepare_pet_avatar_job" && rpc.args[0].p_pet_id === petId && rpc.args[0].p_consent_version === AVATAR_AI_CONSENT_VERSION && rpc.args[0].p_policy_version === AVATAR_AI_POLICY_VERSION, "prepare uses fixed consent and policy versions");
  assert(rpc.args[0].p_client_mutation_id !== rpc.args[0].p_source_asset_id, "reservation identities differ");
  await avatarGenerationApi.upload("reserved/path", photo);
  const uploaded = calls.find((call) => call.name === "upload")!;
  assert(uploaded.args[0] === "pet-avatars" && uploaded.args[1] === "reserved/path" && uploaded.args[2] === source && uploaded.args[3].upsert === false, "upload reserved private object with binary data");
  await avatarGenerationApi.generate(avatarId);
  assert(calls.find((call) => call.name === "invoke")?.args[0] === "generate-pet-avatar", "function endpoint");
  await avatarGenerationApi.apply(petId, avatarId);
  await avatarGenerationApi.find(petId, false);
  assert(calls.some((call) => call.name === "eq" && call.args[0] === "validation_status" && call.args[1] === "validated") && calls.some((call) => call.name === "eq" && call.args[0] === "manifest_version" && call.args[1] === "parametric-v3"), "recovery only reads validated parametric manifests");
  assert(calls.some((call) => call.name === "gte" && call.args[0] === "created_at") && calls.some((call) => call.name === "limit" && call.args[0] === 1), "pending is latest 24h result");
  calls.length = 0;
  await avatarGenerationApi.find(petId, true);
  assert(!calls.some((call) => call.name === "gte"), "applied fallback has no 24h expiry");
} finally { modules._load = original; globalThis.fetch = originalFetch; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
