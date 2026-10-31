import type { PetProfile } from "../../pet/domain/pet";
import { defaultAppearance } from "../domain/appearance";
import { AvatarGenerationError } from "../domain/avatarGeneration";
import type { AvatarGenerationApi } from "../infrastructure/avatarGenerationApi";
import { throwAvatarApiError } from "../infrastructure/avatarGenerationApi";
import { applyGeneratedAvatar, findGeneratedAvatar, generateAvatar } from "./avatarGenerationRepository";
import { readAppearance } from "./appearanceRepository";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function rejects(run: () => Promise<unknown>, code: string) { try { await run(); } catch (error) { assert(error instanceof AvatarGenerationError && error.code === code && error.message === code, `safe ${code}`); return; } throw new Error(`Expected ${code}`); }
const petId = "10000000-0000-4000-8000-000000000001", jobId = "10000000-0000-4000-8000-000000000002", avatarId = "10000000-0000-4000-8000-000000000003";
const pet = { id: petId, species: "cat", role: "owner" } as PetProfile;
const photo = { uri: "file:///cat.png", contentType: "image/png" as const, byteSize: 100 };
const result = { jobId, avatarId, species: "cat" as const, appearance: { ...defaultAppearance(), collar: "red" as const }, confidence: 0.9, createdAt: new Date().toISOString() };
const row = { id: avatarId, job_id: jobId, pet_id: petId, manifest_version: "parametric-v3", manifest: result, is_applied: false, created_at: result.createdAt };
const steps: string[] = [];
const api: AvatarGenerationApi = {
  async prepare(id, input) { assert(id === petId && input === photo, "prepare args"); steps.push("prepare"); return { job_id: jobId, bucket_id: "pet-avatars", source_path: `${petId}/${jobId}/asset` }; },
  async upload(path, input) { assert(path === `${petId}/${jobId}/asset` && input === photo, "upload exact reservation"); steps.push("upload"); },
  async generate(id) { assert(id === jobId, "generate reserved job"); steps.push("invoke"); return result; },
  async apply(id, avatar) { assert(id === petId && avatar === avatarId, "apply exact pet/asset"); steps.push("apply"); },
  async find(id, applied) { assert(id === petId, "find exact pet"); return { ...row, is_applied: applied, created_at: applied ? new Date(Date.parse(result.createdAt) - 1000).toISOString() : row.created_at }; },
};
await rejects(() => generateAvatar(null, pet, photo, () => undefined, api), "avatar_owner_required");
await rejects(() => generateAvatar("user", { ...pet, role: "caregiver" }, photo, () => undefined, api), "avatar_owner_required");
assert(steps.length === 0, "unauthorized start never uploads");
const generated = await generateAvatar("user", pet, photo, () => { steps.push("generating"); }, api);
assert(generated.avatarId === avatarId && steps.join(",") === "prepare,upload,generating,invoke", "prepare/upload/invoke order");
await rejects(() => generateAvatar("user", pet, photo, () => undefined, { ...api, generate: async () => ({ ...result, jobId: petId }) }), "avatar_unknown");
await rejects(() => generateAvatar("user", pet, photo, () => undefined, { ...api, prepare: async () => ({ job_id: jobId, bucket_id: "public", source_path: "wrong" }) }), "avatar_unknown");
await rejects(() => generateAvatar("user", pet, photo, () => undefined, { ...api, upload: async () => { throw new TypeError("private host detail"); } }), "avatar_network");
await rejects(() => throwAvatarApiError({ context: { clone: () => ({ json: async () => ({ error: "avatar_daily_limit", detail: "private" }) }) } }), "avatar_daily_limit");
await rejects(() => throwAvatarApiError({ message: "provider stack with private detail" }), "avatar_unknown");
assert((await findGeneratedAvatar(petId, false, api))?.avatarId === avatarId, "pending recovery");
const currentApplied = { ...row, is_applied: true };
for (const timestamp of [Date.parse(result.createdAt), Date.parse(result.createdAt) + 1000]) {
  const olderPending: AvatarGenerationApi = { ...api, find: async (_id, applied) => applied ? { ...currentApplied, created_at: new Date(timestamp).toISOString() } : row };
  assert(await findGeneratedAvatar(petId, false, olderPending) === null, "pending older than or equal to current applied generation is excluded");
}
assert((await findGeneratedAvatar(petId, false, { ...api, find: async (_id, applied) => applied ? null : row }))?.avatarId === avatarId, "first unapplied generation recovers without applied avatar");
assert(await findGeneratedAvatar(petId, false, { ...api, find: async () => ({ ...row, created_at: new Date(Date.now() - 25 * 3600000).toISOString() }) }) === null, "expired pending ignored");
steps.length = 0;
const applied = await applyGeneratedAvatar("user", pet, result, api, async (_user, _pet, _species, appearance) => { steps.push("save"); return appearance; });
assert(applied.collar === "red" && steps.join(",") === "apply,save", "server apply precedes durable save");
let wrote = false;
await rejects(() => applyGeneratedAvatar("user", pet, result, { ...api, apply: async () => { throw new AvatarGenerationError("avatar_owner_required"); } }, async () => { wrote = true; return result.appearance; }), "avatar_owner_required");
assert(!wrote, "failed apply does not overwrite existing local appearance");
const empty = { getItem: async () => null, setItem: async () => undefined };
assert((await readAppearance("user", petId, "cat", empty, () => api.find(petId, true))).collar === "red", "local miss restores applied server manifest");
assert((await readAppearance("user", petId, "cat", empty, async () => row)).collar === "none", "pending manifest cannot be restored as applied");
assert((await readAppearance("user", petId, "cat", empty, async () => { throw new Error("offline"); })).collar === "none", "offline fallback defaults");
let lookedUp = false;
const local = { ...empty, getItem: async () => JSON.stringify({ version: 1, userId: "user", petId, appearance: defaultAppearance() }) };
const localDefault = await readAppearance("user", petId, "cat", local, async () => { lookedUp = true; return { ...row, is_applied: true }; });
assert(!lookedUp && localDefault.collar === "none", "valid local default is intentional and takes priority over a different server appearance");
const envelope = { version: 1, userId: "user", petId, appearance: defaultAppearance() };
for (const raw of ["broken-json", "null", JSON.stringify({ ...envelope, version: 2 }), JSON.stringify({ ...envelope, userId: "other-user" }), JSON.stringify({ ...envelope, petId: avatarId })]) {
  const damaged = { ...empty, getItem: async () => raw };
  const recovered = await readAppearance("user", petId, "cat", damaged, () => api.find(petId, true));
  assert(recovered.collar === "red", "corrupt or mismatched local envelope restores applied server appearance");
  assert((await readAppearance("user", petId, "cat", damaged, async () => null)).collar === "none", "unusable local and absent server fall back to defaults");
}
const salvage = { ...empty, getItem: async () => JSON.stringify({ ...envelope, appearance: { collar: "blue", eyeColor: "invalid" } }) };
const salvaged = await readAppearance("user", petId, "cat", salvage, async () => { throw new Error("valid local envelope must not request server"); });
assert(salvaged.collar === "blue" && salvaged.eyeColor === "amber", "valid envelope preserves per-field recovery");
