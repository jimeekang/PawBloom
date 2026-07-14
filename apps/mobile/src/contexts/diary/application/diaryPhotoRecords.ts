import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { getLocalDateKey } from "../../../shared-kernel/date";
import { isRetriableOfflineError } from "../../sync/application/offlineErrorPolicy";
import { buildDiaryPhotoStoragePath, removeUploadedPhotoObjects, resolveSupportedPhotoContentType, uploadDiaryPhotoObject, type UploadedPhotoObject } from "../../media/application/mediaUpload";
import type { CreateDiaryEntryInput } from "../domain/diaryEntry";
import { buildOccurredAt, buildOccurredAtForTime } from "./diaryRecordPayload";
import { defaultDiarySummary, encodeDiarySummary } from "./diarySummary";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];

export type PhotoDiaryRowWithMedia = DiaryRow & { media_assets: { id: string; storage_path?: string | null }[] };

export async function createPhotoDiaryEntryAtomic({
  client,
  petId,
  input,
  entryId,
  clientMutationId,
  dependencies = defaultDependencies,
}: {
  client: SupabaseClient<Database>;
  petId: string;
  input: CreateDiaryEntryInput;
  entryId: string;
  clientMutationId: string;
  dependencies?: PhotoDiaryDependencies;
}): Promise<PhotoDiaryRowWithMedia> {
  const existing = await findPhotoDiaryEntry(client, petId, clientMutationId);
  if (existing) return withMediaCount(existing, existing.media_assets?.length ?? 0);

  const entryDate = input.entryDate ?? getLocalDateKey();
  const uploaded: UploadedPhotoObject[] = [];

  try {
    for (const [index, photo] of (input.photos ?? []).entries()) {
      uploaded.push(await dependencies.uploadPhoto(client, petId, entryId, photo, index + 1));
    }

    const { data, error } = await client.rpc("create_photo_diary_entry", {
      p_entry_id: entryId,
      p_pet_id: petId,
      p_entry_date: entryDate,
      p_occurred_at: buildOccurredAtForTime(entryDate, input.occurredTime) ?? buildOccurredAt(entryDate),
      p_summary: encodeDiarySummary({ category: "photo", memo: input.summary }) || defaultDiarySummary("photo"),
      p_client_mutation_id: clientMutationId,
      p_media: uploaded.map(({ storagePath, contentType }) => ({ storage_path: storagePath, content_type: contentType })),
    });

    if (error?.code === "23505") {
      const committed = await findPhotoDiaryEntry(client, petId, clientMutationId);
      if (committed) return withMediaCount(committed, committed.media_assets?.length ?? uploaded.length);
    }
    if (error || !data) throw Object.assign(new Error(error?.message ?? "사진 다이어리를 저장하지 못했습니다."), { code: error?.code });
    return withMediaCount(data, uploaded.length);
  } catch (error) {
    if (!isRetriableOfflineError(error)) {
      try {
        await dependencies.removePhotos(client, uploaded.map((photo) => photo.storagePath));
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], error instanceof Error ? error.message : "사진 다이어리를 저장하지 못했습니다.");
      }
    }
    throw error;
  }
}

export async function updatePhotoDiaryEntryAtomic({
  client,
  petId,
  input,
  entryId,
  appendMutationId,
  dependencies = defaultDependencies,
}: {
  client: SupabaseClient<Database>;
  petId: string;
  input: CreateDiaryEntryInput;
  entryId: string;
  appendMutationId: string;
  dependencies?: PhotoDiaryDependencies;
}): Promise<PhotoDiaryRowWithMedia> {
  const photos = input.photos ?? [];
  const candidates = photos.map((photo, index) => ({
    photo,
    index: index + 1,
    storagePath: buildDiaryPhotoStoragePath(petId, entryId, photo, index + 1, appendMutationId),
    contentType: resolveSupportedPhotoContentType(photo),
  }));
  const registeredPaths = await findRegisteredPhotoPaths(client, petId, entryId, candidates.map((photo) => photo.storagePath));
  const uploaded: UploadedPhotoObject[] = [];
  let committed = false;

  try {
    for (const candidate of candidates) {
      if (registeredPaths.has(candidate.storagePath)) continue;
      uploaded.push(await dependencies.uploadPhoto(client, petId, entryId, candidate.photo, candidate.index, appendMutationId));
    }

    const entryDate = input.entryDate ?? getLocalDateKey();
    const { data, error } = await client.rpc("update_photo_diary_entry", {
      p_entry_id: entryId,
      p_pet_id: petId,
      p_occurred_at: buildOccurredAtForTime(entryDate, input.occurredTime) ?? buildOccurredAt(entryDate),
      p_append_mutation_id: appendMutationId,
      p_media: candidates.map(({ storagePath, contentType }) => ({ storage_path: storagePath, content_type: contentType })),
    });
    if (error || !data) throw Object.assign(new Error(error?.message ?? "사진 다이어리를 수정하지 못했습니다."), { code: error?.code });
    committed = true;

    const updated = await findPhotoDiaryEntryById(client, petId, entryId);
    return updated ?? withMediaCount(data, candidates.length);
  } catch (error) {
    if (!committed && !isRetriableOfflineError(error)) {
      try {
        await dependencies.removePhotos(client, uploaded.map((photo) => photo.storagePath));
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], error instanceof Error ? error.message : "사진 다이어리를 수정하지 못했습니다.");
      }
    }
    throw error;
  }
}

type PhotoDiaryDependencies = {
  uploadPhoto: typeof uploadDiaryPhotoObject;
  removePhotos: typeof removeUploadedPhotoObjects;
};

const defaultDependencies: PhotoDiaryDependencies = {
  uploadPhoto: uploadDiaryPhotoObject,
  removePhotos: removeUploadedPhotoObjects,
};

async function findPhotoDiaryEntry(client: SupabaseClient<Database>, petId: string, clientMutationId: string) {
  const { data, error } = await client
    .from("diary_entries")
    .select("id,pet_id,category,occurred_at,summary,condition_score,entry_date,record_origin,created_by,client_mutation_id,created_at,updated_at,superseded_by,media_assets(id)")
    .eq("pet_id", petId)
    .eq("category", "photo")
    .eq("client_mutation_id", clientMutationId)
    .is("superseded_by", null)
    .maybeSingle();
  if (error && !isRetriableOfflineError(error)) throw new Error(error.message);
  return error ? null : data;
}

async function findPhotoDiaryEntryById(client: SupabaseClient<Database>, petId: string, entryId: string) {
  const { data, error } = await client
    .from("diary_entries")
    .select("id,pet_id,category,occurred_at,summary,condition_score,entry_date,record_origin,created_by,client_mutation_id,created_at,updated_at,superseded_by,media_assets(id,storage_path)")
    .eq("pet_id", petId)
    .eq("id", entryId)
    .eq("category", "photo")
    .is("superseded_by", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findRegisteredPhotoPaths(client: SupabaseClient<Database>, petId: string, entryId: string, storagePaths: string[]) {
  if (storagePaths.length === 0) return new Set<string>();
  const { data, error } = await client
    .from("media_assets")
    .select("storage_path")
    .eq("pet_id", petId)
    .eq("diary_entry_id", entryId)
    .in("storage_path", storagePaths);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((asset) => asset.storage_path));
}

function withMediaCount(row: DiaryRow & { media_assets?: { id: string; storage_path?: string | null }[] | null }, count: number): PhotoDiaryRowWithMedia {
  return { ...row, media_assets: row.media_assets ?? Array.from({ length: count }, (_, index) => ({ id: `${row.id}-${index}` })) };
}
