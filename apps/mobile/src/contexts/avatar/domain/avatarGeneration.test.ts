import { defaultAppearance } from "./appearance";
import { AVATAR_AI_CONSENT_VERSION, AVATAR_AI_POLICY_VERSION, AvatarGenerationError, avatarGenerationErrorCode, isAvatarGenerationRetryable, parseAvatarGenerationResult, parseAvatarRow, validateAvatarPhoto } from "./avatarGeneration";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function rejects(run: () => unknown, code: string) { try { run(); } catch (error) { assert(error instanceof AvatarGenerationError && error.code === code, "safe error code"); return; } throw new Error(`Expected ${code}`); }
const jobId = "10000000-0000-4000-8000-000000000001", avatarId = "10000000-0000-4000-8000-000000000002", petId = "10000000-0000-4000-8000-000000000003";
const result = { jobId, avatarId, species: "cat", appearance: defaultAppearance(), confidence: 0.8, createdAt: new Date().toISOString() };
assert(AVATAR_AI_CONSENT_VERSION === "avatar-ai-2026-10-31" && AVATAR_AI_POLICY_VERSION === "privacy-2026-10-31", "consent contract");
assert(parseAvatarGenerationResult(result).appearance.coatColor === "gray", "valid ready response");
assert(parseAvatarGenerationResult({ ...result, confidence: 0.35 }).confidence === 0.35, "server success confidence threshold is inclusive");
for (const invalid of [{ ...result, confidence: 1.1 }, { ...result, confidence: 0.349 }, { ...result, species: "other" }, { ...result, avatarId: "invalid" }, { ...result, createdAt: null }, { ...result, appearance: { ...result.appearance, eyeColor: "violet" } }, { ...result, species: "fox" }]) rejects(() => parseAvatarGenerationResult(invalid), "avatar_unknown");
const row = { id: avatarId, job_id: jobId, pet_id: petId, manifest_version: "parametric-v3", is_applied: false, created_at: result.createdAt, manifest: result };
assert(parseAvatarRow(row, petId, false)?.avatarId === avatarId, "row maps to public result");
assert(parseAvatarRow(row, "different-pet", false) === null && parseAvatarRow(row, petId, true) === null, "pet and applied boundary");
assert(parseAvatarRow({ ...row, manifest_version: "asset-v1" }, petId, false) === null, "legacy assets cannot become parametric appearance");
assert(parseAvatarRow({ ...row, manifest: { ...result, species: "other" } }, petId, false) === null && parseAvatarRow({ ...row, manifest: { ...result, confidence: 0.349 } }, petId, false) === null, "non-success manifest cannot be recovered");
const photo = { uri: "file:///cat.png", contentType: "image/png" as const, byteSize: 100 };
validateAvatarPhoto(photo);
rejects(() => validateAvatarPhoto({ ...photo, byteSize: 5 * 1024 * 1024 + 1 }), "avatar_image_too_large");
rejects(() => validateAvatarPhoto({ ...photo, byteSize: 0 }), "avatar_invalid_input");
assert(avatarGenerationErrorCode("private provider error") === "avatar_unknown" && avatarGenerationErrorCode("avatar_job_closed") === "avatar_unknown", "unrecognized errors never leak");
assert(isAvatarGenerationRetryable("avatar_network") && !isAvatarGenerationRetryable("avatar_provider_refused"), "retryable failures differ from refusal");
