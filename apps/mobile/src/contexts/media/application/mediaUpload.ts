import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";

export type PhotoUploadInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
};

export type UploadedPhotoObject = {
  storagePath: string;
  contentType: string;
};

export async function uploadDiaryPhotoObject(
  client: SupabaseClient<Database>,
  petId: string,
  diaryEntryId: string,
  photo: PhotoUploadInput,
  index: number,
  uploadNamespace?: string,
): Promise<UploadedPhotoObject> {
  const contentType = resolveSupportedPhotoContentType(photo);
  const storagePath = buildDiaryPhotoStoragePath(petId, diaryEntryId, photo, index, uploadNamespace);
  const uploadBody = await buildPhotoUploadBody(photo);

  const { error } = await client.storage.from("pet-media").upload(storagePath, uploadBody, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(error.message ?? "사진 업로드에 실패했습니다.");
  return { storagePath, contentType };
}

export function buildDiaryPhotoStoragePath(
  petId: string,
  diaryEntryId: string,
  photo: PhotoUploadInput,
  index: number,
  uploadNamespace?: string,
) {
  const contentType = resolveSupportedPhotoContentType(photo);
  const extension = extensionForContentType(contentType);
  const safeName = photo.fileName?.replace(/[^a-zA-Z0-9._-]/g, "-") || `diary.${extension}`;
  const safeNamespace = uploadNamespace?.replace(/[^a-zA-Z0-9-]/g, "-");
  return `${petId}/diary/${diaryEntryId}/${safeNamespace ? `${safeNamespace}-` : ""}${index}-${safeName}`;
}

export async function removeUploadedPhotoObjects(client: SupabaseClient<Database>, storagePaths: string[]) {
  if (storagePaths.length === 0) return;
  const { error } = await client.storage.from("pet-media").remove(storagePaths);
  if (error) throw new Error(error.message ?? "업로드된 사진 정리에 실패했습니다.");
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

export function resolveSupportedPhotoContentType(photo: PhotoUploadInput) {
  if (photo.base64) return "image/jpeg";
  if (photo.mimeType === "image/jpeg" || photo.mimeType === "image/png" || photo.mimeType === "image/webp") return photo.mimeType;
  if (photo.mimeType?.startsWith("image/")) throw new Error("JPEG, PNG, WebP 사진만 저장할 수 있습니다.");
  return "image/jpeg";
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
