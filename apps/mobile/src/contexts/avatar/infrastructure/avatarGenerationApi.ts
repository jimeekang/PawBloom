import { z } from "zod";
import { supabase } from "../../../shared-kernel/supabase/client";
import { createUuid } from "../../../shared-kernel/uuid";
import { AVATAR_AI_CONSENT_VERSION, AVATAR_AI_POLICY_VERSION, AvatarGenerationError, avatarGenerationErrorCode, type AvatarPhotoInput } from "../domain/avatarGeneration";

export type AvatarGenerationApi = {
  prepare(petId: string, photo: AvatarPhotoInput): Promise<unknown>;
  upload(path: string, photo: AvatarPhotoInput): Promise<void>;
  generate(jobId: string): Promise<unknown>;
  apply(petId: string, avatarId: string): Promise<void>;
  find(petId: string, applied: boolean): Promise<unknown>;
};
function client() {
  if (!supabase) throw new AvatarGenerationError("avatar_network");
  return supabase;
}
export async function throwAvatarApiError(error: unknown): Promise<never> {
  if (error instanceof AvatarGenerationError) throw error;
  const source = error as { context?: { clone(): { json(): Promise<unknown> } }; message?: unknown; name?: unknown } | null;
  if (source?.context) {
    try {
      const payload = await source.context.clone().json() as { error?: unknown };
      throw new AvatarGenerationError(avatarGenerationErrorCode(payload?.error));
    } catch (parsedError) {
      if (parsedError instanceof AvatarGenerationError) throw parsedError;
    }
  }
  const code = avatarGenerationErrorCode(source?.message);
  if (code !== "avatar_unknown") throw new AvatarGenerationError(code);
  throw new AvatarGenerationError(error instanceof TypeError || ["FunctionsFetchError", "FunctionsRelayError"].includes(String(source?.name)) ? "avatar_network" : "avatar_unknown");
}
export const avatarGenerationApi: AvatarGenerationApi = {
  async prepare(petId, photo) {
    const { data, error } = await client().rpc("prepare_pet_avatar_job", {
      p_pet_id: petId, p_client_mutation_id: createUuid(), p_source_asset_id: createUuid(),
      p_source_content_type: photo.contentType, p_source_byte_size: photo.byteSize,
      p_consent_version: AVATAR_AI_CONSENT_VERSION, p_policy_version: AVATAR_AI_POLICY_VERSION,
    });
    if (error) return throwAvatarApiError(error);
    return data;
  },
  async upload(path, photo) {
    try {
      const response = await fetch(photo.uri);
      if (!response.ok) throw new AvatarGenerationError("avatar_image_invalid");
      const body = await response.arrayBuffer();
      if (body.byteLength !== photo.byteSize) throw new AvatarGenerationError("avatar_image_invalid");
      const { error } = await client().storage.from("pet-avatars").upload(path, body, { contentType: photo.contentType, upsert: false });
      if (error) await throwAvatarApiError(error);
    } catch (error) { await throwAvatarApiError(error); }
  },
  async generate(jobId) {
    const { data, error } = await client().functions.invoke<unknown>("generate-pet-avatar", { body: { jobId } });
    if (error) return throwAvatarApiError(error);
    return data;
  },
  async apply(petId, avatarId) {
    const { data, error } = await client().rpc("apply_pet_avatar", { p_pet_id: petId, p_avatar_id: avatarId });
    if (error) await throwAvatarApiError(error);
    const parsed = z.object({ pet_id: z.literal(petId), avatar_id: z.literal(avatarId), applied: z.literal(true) }).safeParse(data);
    if (!parsed.success) throw new AvatarGenerationError("avatar_unknown");
  },
  async find(petId, applied) {
    if (!supabase) return null;
    let query = supabase.from("pet_avatars").select("id,pet_id,job_id,manifest_version,manifest,is_applied,created_at")
      .eq("pet_id", petId).eq("validation_status", "validated").eq("manifest_version", "parametric-v3").eq("is_applied", applied);
    if (!applied) query = query.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) await throwAvatarApiError(error);
    return data;
  },
};
