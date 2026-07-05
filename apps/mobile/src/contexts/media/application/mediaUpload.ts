import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";

export type PhotoUploadInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
};

export async function uploadDiaryPhoto(
  client: SupabaseClient<Database>,
  userId: string,
  petId: string,
  diaryEntryId: string,
  photo: PhotoUploadInput,
  index: number,
) {
  const contentType = resolvePhotoContentType(photo);
  const extension = extensionForContentType(contentType);
  const safeName = photo.fileName?.replace(/[^a-zA-Z0-9._-]/g, "-") || `diary.${extension}`;
  const storagePath = `${petId}/diary/${diaryEntryId}/${Date.now()}-${index}-${safeName}`;
  const uploadBody = await buildPhotoUploadBody(photo);

  const { error: uploadError } = await client.storage.from("pet-media").upload(storagePath, uploadBody, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message ?? "사진 업로드에 실패했습니다.");
  }

  const { error: assetError } = await client.from("media_assets").insert({
    pet_id: petId,
    diary_entry_id: diaryEntryId,
    storage_path: storagePath,
    content_type: contentType,
    created_by: userId,
  });

  if (assetError) {
    await client.storage.from("pet-media").remove([storagePath]);
    throw new Error(assetError.message ?? "사진 기록 저장에 실패했습니다.");
  }

  return storagePath;
}

export function buildPhotoUploadBody(photo: PhotoUploadInput & { base64: string }): ArrayBuffer;
export function buildPhotoUploadBody(photo: PhotoUploadInput): ArrayBuffer | Promise<Blob>;
export function buildPhotoUploadBody(photo: PhotoUploadInput): ArrayBuffer | Promise<Blob> {
  if (photo.base64) {
    return decodeBase64ToArrayBuffer(photo.base64);
  }

  return fetchPhotoBlob(photo.uri);
}

function extensionForContentType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function resolvePhotoContentType(photo: PhotoUploadInput) {
  if (photo.base64) return "image/jpeg";
  return photo.mimeType?.startsWith("image/") ? photo.mimeType : "image/jpeg";
}

async function fetchPhotoBlob(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("사진을 읽을 수 없습니다.");
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
      throw new Error("사진을 읽을 수 없습니다.");
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
