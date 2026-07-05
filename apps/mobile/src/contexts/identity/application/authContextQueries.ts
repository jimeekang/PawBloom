import { type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";
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
  await (client.from("profiles") as any).upsert(
    {
      id: authUser.id,
      email: authUser.email ?? null,
    },
    { onConflict: "id" },
  );
}

export async function loadPetRows(client: QueryClient): Promise<PetRecord[]> {
  const { data, error } = (await (client.from("pets") as any)
    .select(petSelectColumns)
    .order("created_at", { ascending: false })) as {
    data: PetRecord[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    throw new Error(error?.message ?? "반려동물 목록을 불러오지 못했습니다.");
  }

  return data;
}

export async function createPetRow(client: QueryClient, userId: string, input: CreatePetInput): Promise<PersistedPet> {
  const payload = toPetPayload(input);

  const { error: insertError } = (await (client.from("pets") as any)
    .insert({
      owner_id: userId,
      ...payload,
    }) as any);

  if (insertError) {
    throw new Error(insertError.message ?? "반려동물 프로필을 생성하지 못했습니다.");
  }

  const { data, error } = (await (client.from("pets") as any)
    .select(petSelectColumns)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()) as {
    data: PetRecord | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    throw new Error(error?.message ?? "반려동물 프로필을 생성하지 못했습니다.");
  }

  return mapDbPet(data);
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

  return mapDbPet(data);
}

export async function uploadPetProfilePhoto(
  client: SupabaseClient<Database>,
  userId: string,
  petId: string,
  photo: PetProfilePhotoInput,
): Promise<string> {
  const contentType = resolvePhotoContentType(photo);
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

  const { error: assetError } = await client.from("media_assets").insert({
    pet_id: petId,
    storage_path: storagePath,
    content_type: contentType,
    created_by: userId,
  });

  if (assetError) {
    throw new Error(assetError.message ?? "반려동물 사진 저장에 실패했습니다.");
  }

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

export async function deletePetRow(client: QueryClient, petId: string): Promise<void> {
  const { count, error } = (await (client.from("pets") as any).delete({ count: "exact" }).eq("id", petId)) as {
    count: number | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(error.message ?? "반려동물 프로필을 삭제하지 못했습니다.");
  }

  if (count === 0) {
    throw new Error("반려동물 프로필을 삭제하지 못했습니다.");
  }
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

function resolvePhotoContentType(photo: PetProfilePhotoInput) {
  if (photo.base64) return "image/jpeg";
  return photo.mimeType?.startsWith("image/") ? photo.mimeType : "image/jpeg";
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
