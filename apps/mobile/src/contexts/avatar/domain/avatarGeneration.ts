import { z } from "zod";
import { appearanceSchema, type Appearance, type CharacterSpecies } from "./appearance";

export const AVATAR_AI_CONSENT_VERSION = "avatar-ai-2026-10-31";
export const AVATAR_AI_POLICY_VERSION = "privacy-2026-10-31";
export type AvatarGenerationErrorCode = "avatar_owner_required" | "avatar_invalid_input" | "avatar_daily_limit" | "avatar_image_too_large" | "avatar_image_invalid" | "avatar_provider_refused" | "avatar_provider_failed" | "avatar_no_pet_found" | "avatar_in_progress" | "avatar_not_found" | "avatar_network" | "avatar_unknown";
export type AvatarGenerationResult = { jobId: string; avatarId: string; species: CharacterSpecies; appearance: Appearance; confidence: number; createdAt: string };
export type AvatarPhotoInput = { uri: string; contentType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number };

const speciesSchema = z.enum(["cat", "dog"]);
const uuid = z.uuid();
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
export const avatarGenerationResultSchema = z.object({
  jobId: uuid, avatarId: uuid, species: speciesSchema, appearance: appearanceSchema,
  confidence: z.number().min(0.35).max(1), createdAt: timestamp,
});
const avatarRowSchema = z.object({
  id: uuid, pet_id: uuid, job_id: uuid, manifest_version: z.literal("parametric-v3"),
  is_applied: z.boolean(), created_at: timestamp,
  manifest: z.object({ appearance: appearanceSchema, species: speciesSchema, confidence: z.number().min(0.35).max(1) }),
});
export function parseAvatarGenerationResult(input: unknown): AvatarGenerationResult {
  const parsed = avatarGenerationResultSchema.safeParse(input);
  if (!parsed.success) throw new AvatarGenerationError("avatar_unknown");
  return parsed.data;
}
export function parseAvatarRow(input: unknown, petId: string, applied: boolean): AvatarGenerationResult | null {
  const parsed = avatarRowSchema.safeParse(input);
  if (!parsed.success || parsed.data.pet_id !== petId || parsed.data.is_applied !== applied) return null;
  const row = parsed.data;
  return { jobId: row.job_id, avatarId: row.id, species: row.manifest.species, appearance: row.manifest.appearance, confidence: row.manifest.confidence, createdAt: row.created_at };
}
export class AvatarGenerationError extends Error {
  constructor(readonly code: AvatarGenerationErrorCode) { super(code); this.name = "AvatarGenerationError"; }
}
const errorCodes: readonly AvatarGenerationErrorCode[] = ["avatar_owner_required", "avatar_invalid_input", "avatar_daily_limit", "avatar_image_too_large", "avatar_image_invalid", "avatar_provider_refused", "avatar_provider_failed", "avatar_no_pet_found", "avatar_in_progress", "avatar_not_found", "avatar_network", "avatar_unknown"];
export function avatarGenerationErrorCode(input: unknown): AvatarGenerationErrorCode {
  return typeof input === "string" && errorCodes.includes(input as AvatarGenerationErrorCode) ? input as AvatarGenerationErrorCode : "avatar_unknown";
}
export function isAvatarGenerationRetryable(code: AvatarGenerationErrorCode): boolean {
  return ["avatar_provider_failed", "avatar_network", "avatar_unknown", "avatar_in_progress"].includes(code);
}
export function validateAvatarPhoto(photo: AvatarPhotoInput): void {
  if (!photo || typeof photo.uri !== "string" || !photo.uri.trim() || !["image/jpeg", "image/png", "image/webp"].includes(photo.contentType) || !Number.isSafeInteger(photo.byteSize) || photo.byteSize <= 0) throw new AvatarGenerationError("avatar_invalid_input");
  if (photo.byteSize > 5 * 1024 * 1024) throw new AvatarGenerationError("avatar_image_too_large");
}
