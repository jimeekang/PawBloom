import { supabase } from "../../../shared-kernel/supabase/client";
import { buildDiaryReplayInsertPayload, buildMedicationDoseReplayUpdatePayload } from "./offlineMutationPayload";
import type { OfflineReplayHandlers, ReplayDiaryEntryInput, ReplayMedicationDoseInput } from "./offlineReplayPolicy";

export const supabaseOfflineReplayHandlers: OfflineReplayHandlers = {
  insertDiaryEntry,
  getMedicationDose,
  updateMedicationDose,
};

async function insertDiaryEntry(input: ReplayDiaryEntryInput) {
  if (!supabase) throw new Error("Supabase client is not configured.");
  const { error } = await supabase.from("diary_entries").insert(buildDiaryReplayInsertPayload(input));
  if (error && error.code !== "23505") throw new Error(error.message);
}

async function getMedicationDose(input: { petId: string; id: string }) {
  if (!supabase) throw new Error("Supabase client is not configured.");
  const { data, error } = await supabase
    .from("medication_doses")
    .select("id,status")
    .eq("id", input.id)
    .eq("pet_id", input.petId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id, status: data.status } : null;
}

async function updateMedicationDose(input: ReplayMedicationDoseInput) {
  if (!supabase) throw new Error("Supabase client is not configured.");
  const { error } = await supabase
    .from("medication_doses")
    .update(buildMedicationDoseReplayUpdatePayload(input))
    .eq("id", input.input.id)
    .eq("pet_id", input.petId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}
