import { type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database, Json } from "../../../shared-kernel/supabase/database.types";
import type { PetMemberRole } from "../../../shared-kernel/types";
import { decodeMediaCleanupEnvelope, removeQueuedMediaObjects } from "../../media/application/mediaCleanup";
import { resolveSupportedPhotoContentType } from "../../media/application/mediaUpload";
import { isRetriableOfflineError } from "../../sync/application/offlineErrorPolicy";
import { mapDbPet, normalizeSpecies, type PetProfile, type PetRecord } from "../../pet/domain/pet";

export type CreatePetInput = {
  name: string;
  species: string;
  breed?: string;
  birthdate?: string;
  weightKg?: number;
  profilePhoto?: PetProfilePhotoInput;
};

export type UpdatePetInput = CreatePetInput & {
  id: string;
};

export type PersistedPet = PetProfile;
export { deletePetRow } from "./petDeletion";

export type LoadedPetRecord = PetRecord & {
  membershipRole: PetMemberRole;
};

type QueryClient = {
  from: (table: string) => any;
};

export type PetProfilePhotoInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
};
export async function ensureProfileRow(client: QueryClient, authUser: User): Promise<void> {
  const { data, error } = await (client.from("profiles") as any)
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (error || !data) throw new Error("profile_load_failed");
}

export async function loadPetRows(client: QueryClient, userId: string): Promise<LoadedPetRecord[]> {
  const { data, error } = (await (client.from("pets") as any)
    .select(petSelectColumns)
    .order("created_at", { ascending: false })) as {
    data: PetRecord[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    throw new Error(error?.message ?? "반려동물 목록을 불러오지 못했습니다.");
  }

  if (data.length === 0) return [];

  const petIds = data.map((pet) => pet.id);
  const { data: memberships, error: membershipError } = (await (client.from("pet_members") as any)
    .select("pet_id,role,starts_at,ends_at")
    .eq("user_id", userId)
    .in("pet_id", petIds)) as {
    data: Array<{ pet_id: string; role: string; starts_at?: string | null; ends_at?: string | null }> | null;
    error: { message: string } | null;
  };

  if (membershipError || !memberships) {
    throw new Error(membershipError?.message ?? "반려동물 권한을 불러오지 못했습니다.");
  }

  const rolesByPetId = new Map<string, PetMemberRole>();
  for (const membership of memberships) {
    if (isPetMemberRole(membership.role) && isMembershipActive(membership)) rolesByPetId.set(membership.pet_id, membership.role);
  }

  return data.flatMap((pet) => {
    const membershipRole = rolesByPetId.get(pet.id);
    return membershipRole ? [{ ...pet, membershipRole }] : [];
  });
}

export async function createPetRow(client: QueryClient, userId: string, input: CreatePetInput): Promise<PersistedPet> {
  const payload = toPetPayload(input);

  const { data, error } = (await (client.from("pets") as any)
    .insert({
      owner_id: userId,
      ...payload,
    })
    .select(petSelectColumns)
    .single()) as {
    data: PetRecord | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    throw new Error(error?.message ?? "반려동물 프로필을 생성하지 못했습니다.");
  }

  return mapDbPet(data, "owner");
}

export async function updatePetRow(client: QueryClient, input: UpdatePetInput): Promise<PersistedPet> {
  const { data, error } = (await (client.from("pets") as any)
    .update(toPetPayload(input))
    .eq("id", input.id)
    .select(petSelectColumns)
    .single()) as {
    data: PetRecord | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    throw new Error(error?.message ?? "반려동물 프로필을 수정하지 못했습니다.");
  }

  return mapDbPet(data, "owner");
}

export async function uploadPetProfilePhoto(
  client: SupabaseClient<Database>,
  _userId: string,
  petId: string,
  photo: PetProfilePhotoInput,
): Promise<string> {
  const contentType = resolveSupportedPhotoContentType(photo);
  const extension = extensionForContentType(contentType);
  const safeName = photo.fileName?.replace(/[^a-zA-Z0-9._-]/g, "-") || `profile.${extension}`;
  const storagePath = `${petId}/profile/${Date.now()}-${safeName}`;
  const uploadBody = await buildPhotoUploadBody(photo);

  const { error: uploadError } = await client.storage.from("pet-media").upload(storagePath, uploadBody, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message ?? "반려동물 사진 업로드에 실패했습니다.");
  }

  const rpcArgs = {
      p_pet_id: petId,
      p_storage_path: storagePath,
      p_content_type: contentType,
  };
  let assetResult: Json | null = null;
  let lastError: unknown = new Error("반려동물 사진 저장에 실패했습니다.");
  let ambiguousAttempt = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await client.rpc("replace_pet_profile_photo_v1", rpcArgs);
      if (!result.error && result.data) { assetResult = result.data; break; }
      lastError = Object.assign(new Error(result.error?.message ?? "반려동물 사진 저장에 실패했습니다."), { code: result.error?.code });
    } catch (error) {
      lastError = error;
    }
    if (!isRetriableOfflineError(lastError)) break;
    ambiguousAttempt = true;
  }
  if (!assetResult) {
    if (!ambiguousAttempt) {
      await client.storage.from("pet-media").remove([storagePath]);
    }
    throw lastError;
  }

  const { cleanupPaths } = decodeMediaCleanupEnvelope<{ storage_path: string }>(assetResult);
  await removeQueuedMediaObjects(client, cleanupPaths);
  return storagePath;
}

export function buildPhotoUploadBody(photo: PetProfilePhotoInput & { base64: string }): ArrayBuffer;
export function buildPhotoUploadBody(photo: PetProfilePhotoInput): ArrayBuffer | Promise<Blob>;
export function buildPhotoUploadBody(photo: PetProfilePhotoInput): ArrayBuffer | Promise<Blob> {
  if (photo.base64) {
    return decodeBase64ToArrayBuffer(photo.base64);
  }

  return fetchPhotoBlob(photo.uri);
}

function toPetPayload(input: CreatePetInput) {
  const weightKg = input.weightKg !== undefined && !Number.isNaN(input.weightKg) ? input.weightKg : null;

  return {
    name: input.name.trim(),
    species: normalizeSpecies(input.species),
    breed: input.breed?.trim() || null,
    birthdate: input.birthdate?.trim() || null,
    weight_kg: weightKg,
  };
}

function extensionForContentType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function fetchPhotoBlob(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("반려동물 사진을 읽을 수 없습니다.");
  }

  return response.blob();
}

function decodeBase64ToArrayBuffer(base64: string) {
  const cleanBase64 = base64.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  const padding = cleanBase64.endsWith("==") ? 2 : cleanBase64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((cleanBase64.length * 3) / 4) - padding;
  const bytes = new Uint8Array(byteLength);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (const char of cleanBase64.replace(/=+$/, "")) {
    const value = alphabet.indexOf(char);
    if (value < 0) {
      throw new Error("반려동물 사진을 읽을 수 없습니다.");
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }

  return bytes.buffer;
}

const petSelectColumns = "id,name,species,breed,birthdate,weight_kg";

function isPetMemberRole(value: string): value is PetMemberRole {
  return value === "owner" || value === "caregiver" || value === "pet_sitter";
}

function isMembershipActive(membership: { starts_at?: string | null; ends_at?: string | null }, now = Date.now()) {
  const startsAt = membership.starts_at ? Date.parse(membership.starts_at) : null;
  const endsAt = membership.ends_at ? Date.parse(membership.ends_at) : null;
  if (startsAt !== null && (!Number.isFinite(startsAt) || startsAt > now)) return false;
  if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt < now)) return false;
  return true;
}
