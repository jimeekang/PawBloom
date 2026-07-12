import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { isRetriableOfflineError } from "../../sync/application/offlineErrorPolicy";

type DoseRow = Database["public"]["Tables"]["medication_doses"]["Row"];

export async function deleteMedicationDoseWithRetry(
  client: SupabaseClient<Database>,
  petId: string,
  doseId: string,
): Promise<DoseRow | null> {
  let ambiguousAttempt = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await client
        .from("medication_doses")
        .delete()
        .eq("id", doseId)
        .eq("pet_id", petId)
        .select()
        .maybeSingle();
      if (!error && data) return data;
      if (ambiguousAttempt && (!error || error.code === "PGRST116")) return null;
      const failure = Object.assign(new Error(error?.message ?? "Medication dose not found."), { code: error?.code });
      if (!isRetriableOfflineError(failure)) throw failure;
      ambiguousAttempt = true;
    } catch (error) {
      if (!isRetriableOfflineError(error)) throw error;
      ambiguousAttempt = true;
    }
  }
  throw new Error("Medication deletion could not be confirmed after retry.");
}
