import { z } from "zod";
import type { PetProfile } from "../../pet/domain/pet";
import { AvatarGenerationError, parseAvatarGenerationResult, parseAvatarRow, validateAvatarPhoto, type AvatarGenerationResult, type AvatarPhotoInput } from "../domain/avatarGeneration";
import { avatarGenerationApi, throwAvatarApiError, type AvatarGenerationApi } from "../infrastructure/avatarGenerationApi";
import { saveAppearance } from "./appearanceRepository";

export async function generateAvatar(userId: string | null, pet: PetProfile, photo: AvatarPhotoInput, generating: () => void, api: AvatarGenerationApi = avatarGenerationApi): Promise<AvatarGenerationResult> {
  if (!userId || pet.role !== "owner") throw new AvatarGenerationError("avatar_owner_required");
  validateAvatarPhoto(photo);
  try {
    const prepared = z.object({ job_id: z.uuid(), source_path: z.string().min(1), bucket_id: z.literal("pet-avatars") }).safeParse(await api.prepare(pet.id, photo));
    if (!prepared.success || !prepared.data.source_path.startsWith(`${pet.id}/${prepared.data.job_id}/`)) throw new AvatarGenerationError("avatar_unknown");
    await api.upload(prepared.data.source_path, photo);
    generating();
    const result = parseAvatarGenerationResult(await api.generate(prepared.data.job_id));
    if (result.jobId !== prepared.data.job_id) throw new AvatarGenerationError("avatar_unknown");
    return result;
  } catch (error) { return throwAvatarApiError(error); }
}
export async function findGeneratedAvatar(petId: string, applied: boolean, api: AvatarGenerationApi = avatarGenerationApi): Promise<AvatarGenerationResult | null> {
  const result = parseAvatarRow(await api.find(petId, applied), petId, applied);
  if (!result || (!applied && (Date.parse(result.createdAt) < Date.now() - 24 * 60 * 60 * 1000 || Date.parse(result.createdAt) > Date.now()))) return null;
  if (!applied) {
    const current = parseAvatarRow(await api.find(petId, true), petId, true);
    if (current && Date.parse(result.createdAt) <= Date.parse(current.createdAt)) return null;
  }
  return result;
}
export async function applyGeneratedAvatar(userId: string | null, pet: PetProfile, input: AvatarGenerationResult, api: AvatarGenerationApi = avatarGenerationApi, save = saveAppearance) {
  if (!userId || pet.role !== "owner") throw new AvatarGenerationError("avatar_owner_required");
  const result = parseAvatarGenerationResult(input);
  try {
    await api.apply(pet.id, result.avatarId);
    return await save(userId, pet.id, pet.species, result.appearance);
  } catch (error) { return throwAvatarApiError(error); }
}
