import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { CreateDiaryEntryInput, DiaryCategory } from "../domain/diaryEntry";
import { buildDiaryUpdatePayload } from "./diaryRecordPayload";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
export type DiaryRowWithMedia = DiaryRow & { media_assets?: { id: string; storage_path?: string | null }[] | null };
type SignedDiaryPhoto = { error: string | null; path: string | null; signedUrl: string | null };

export const diaryEntrySelect = "id,pet_id,category,occurred_at,summary,condition_score,entry_date,record_origin,created_by,client_mutation_id,created_at,updated_at,superseded_by,media_assets(id,storage_path)";
const DIARY_PHOTO_URL_TTL_SECONDS = 60 * 60;

export async function fetchDiaryRowsWithPhotoUrls(petId: string, fromDateKey: string, toDateKey: string) {
  const { data, error } = await supabase!
    .from("diary_entries")
    .select(diaryEntrySelect)
    .eq("pet_id", petId)
    .gte("entry_date", fromDateKey)
    .lte("entry_date", toDateKey)
    .is("superseded_by", null)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DiaryRowWithMedia[];
  const storagePaths = [...new Set(rows.flatMap((row) => (row.media_assets ?? []).flatMap((asset) => asset.storage_path ? [asset.storage_path] : [])))];
  if (storagePaths.length === 0) return pairDiaryRowsWithSignedPhotos(rows, []);

  const { data: signedPhotos, error: signedPhotoError } = await supabase!.storage.from("pet-media").createSignedUrls(storagePaths, DIARY_PHOTO_URL_TTL_SECONDS);
  if (signedPhotoError) throw new Error(signedPhotoError.message);
  return pairDiaryRowsWithSignedPhotos(rows, signedPhotos);
}

export function pairDiaryRowsWithSignedPhotos(rows: DiaryRowWithMedia[], signedPhotos: SignedDiaryPhoto[]) {
  const signedUrlByPath = new Map(signedPhotos.flatMap((photo) => photo.path && photo.signedUrl && !photo.error ? [[photo.path, photo.signedUrl] as const] : []));
  return rows.map((row) => ({
    row,
    photoUrls: (row.media_assets ?? []).flatMap((asset) => {
      const signedUrl = asset.storage_path ? signedUrlByPath.get(asset.storage_path) : undefined;
      return signedUrl ? [signedUrl] : [];
    }),
  }));
}

export async function fetchDiaryEntryByClientMutationId(petId: string, clientMutationId: string) {
  const { data, error } = await supabase!
    .from("diary_entries")
    .select(diaryEntrySelect)
    .eq("pet_id", petId)
    .eq("client_mutation_id", clientMutationId)
    .is("superseded_by", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DiaryRowWithMedia | null;
}

export async function fetchExistingDailyStructuredEntry(petId: string, category: DiaryCategory, entryDate: string) {
  const { data, error } = await supabase!
    .from("diary_entries")
    .select(diaryEntrySelect)
    .eq("pet_id", petId)
    .eq("category", category)
    .eq("entry_date", entryDate)
    .is("superseded_by", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DiaryRowWithMedia | null;
}

export async function updateCanonicalStructuredEntry(
  petId: string,
  entryId: string,
  input: CreateDiaryEntryInput,
  entryDate: string,
) {
  const { data, error } = await supabase!
    .from("diary_entries")
    .update(buildDiaryUpdatePayload({ ...input, id: entryId, entryDate, origin: "diary" }))
    .eq("id", entryId)
    .eq("pet_id", petId)
    .is("superseded_by", null)
    .select(diaryEntrySelect)
    .single();
  if (error) throw new Error(error.message);
  return data as DiaryRowWithMedia;
}
