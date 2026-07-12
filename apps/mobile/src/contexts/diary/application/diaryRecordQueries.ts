import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { CreateDiaryEntryInput, DiaryCategory } from "../domain/diaryEntry";
import { buildDiaryUpdatePayload } from "./diaryRecordPayload";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
export type DiaryRowWithMedia = DiaryRow & { media_assets?: { id: string }[] | null };

export const diaryEntrySelect = "id,pet_id,category,occurred_at,summary,condition_score,entry_date,record_origin,created_by,client_mutation_id,created_at,updated_at,superseded_by,media_assets(id)";

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
