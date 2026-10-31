import { z } from "npm:zod@4.6.7";

// Verified byte-for-byte against the mobile appearance option arrays.
export const coatColors = ["white", "cream", "ginger", "brown", "gray", "black", "lilac", "chocolate"] as const;
export const coatPatterns = ["solid", "tabby", "bicolor", "calico", "pointed", "tabbyWhite"] as const;
export const eyeColors = ["amber", "green", "blue", "copper", "odd"] as const;
export const earShapes = ["pointed", "folded", "curled", "floppy"] as const;
export const furLengths = ["short", "long"] as const;
export const builds = ["slim", "regular", "round"] as const;
export const tails = ["long", "short", "fluffy"] as const;
export const faceMarks = ["none", "blaze", "maskedEyes", "whiteMuzzle"] as const;
export const collars = ["none", "red", "blue", "yellow", "green"] as const;
export const appearanceSchema = z.object({
  coatColor: z.enum(coatColors), coatPattern: z.enum(coatPatterns), accentColor: z.enum(coatColors),
  eyeColor: z.enum(eyeColors), earShape: z.enum(earShapes), furLength: z.enum(furLengths),
  build: z.enum(builds), tail: z.enum(tails), faceMark: z.enum(faceMarks), collar: z.enum(collars),
}).strict();
export const AvatarResultSchema = z.object({
  species: z.enum(["cat", "dog", "other"]), appearance: appearanceSchema,
  confidence: z.number().min(0).max(1),
}).strict();
export type AvatarResult = z.infer<typeof AvatarResultSchema>;
export type AvatarErrorCode = "avatar_owner_required" | "avatar_invalid_input" | "avatar_daily_limit"
  | "avatar_image_too_large" | "avatar_image_invalid" | "avatar_provider_refused" | "avatar_provider_failed"
  | "avatar_no_pet_found" | "avatar_in_progress" | "avatar_not_found" | "avatar_job_closed" | "avatar_unknown";
export class AvatarError extends Error {
  constructor(public code: AvatarErrorCode) { super(code); }
}
export function errorStatus(code: AvatarErrorCode) {
  return ({ avatar_owner_required: 403, avatar_invalid_input: 400, avatar_daily_limit: 429,
    avatar_image_too_large: 413, avatar_image_invalid: 400, avatar_provider_refused: 422,
    avatar_provider_failed: 502, avatar_no_pet_found: 422, avatar_in_progress: 409,
    avatar_not_found: 404, avatar_job_closed: 409, avatar_unknown: 500 })[code];
}
export function parseJobId(input: unknown): string {
  const parsed = z.object({ jobId: z.uuid() }).strict().safeParse(input);
  if (!parsed.success) throw new AvatarError("avatar_invalid_input");
  return parsed.data.jobId;
}
export function parseAvatarResult(input: unknown): AvatarResult {
  const parsed = AvatarResultSchema.safeParse(input);
  if (!parsed.success) throw new AvatarError("avatar_provider_failed");
  const result = parsed.data;
  const a = result.appearance;
  if ((result.species === "dog" && (!["solid", "bicolor"].includes(a.coatPattern) || !["pointed", "floppy"].includes(a.earShape)))
    || (result.species === "cat" && a.earShape === "floppy")
    || (a.coatPattern === "pointed" && (a.coatColor !== "cream" || a.eyeColor !== "blue"))) {
    throw new AvatarError("avatar_provider_failed");
  }
  return result;
}
export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export function validateImage(bytes: Uint8Array, contentType: string, expectedSize: number): ImageType {
  if (bytes.byteLength > 5 * 1024 * 1024 || expectedSize > 5 * 1024 * 1024) throw new AvatarError("avatar_image_too_large");
  const isPng = bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b);
  const isJpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const isWebp = bytes.length >= 16 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (expectedSize !== bytes.byteLength || !((contentType === "image/png" && isPng)
    || (contentType === "image/jpeg" && isJpeg) || (contentType === "image/webp" && isWebp))) throw new AvatarError("avatar_image_invalid");
  return contentType as ImageType;
}
export function readyResponse(avatar: { id: string; job_id: string; created_at: string; manifest: unknown }) {
  const m = avatar.manifest as Record<string, unknown> | null;
  const a = m?.appearance as Record<string, unknown> | null;
  const result = parseAvatarResult({ species: m?.species, confidence: m?.confidence,
    appearance: a ? Object.fromEntries(Object.entries(a).filter(([key]) => key !== "version")) : null });
  return { jobId: avatar.job_id, avatarId: avatar.id, status: "ready" as const, species: result.species,
    appearance: { version: 1 as const, ...result.appearance }, confidence: result.confidence, createdAt: avatar.created_at };
}
