import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { decodeMediaCleanupEnvelope, removeQueuedMediaObjects } from "../../media/application/mediaCleanup";
import { isRetriableOfflineError } from "../../sync/application/offlineErrorPolicy";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];

export type DeletedDiaryRow = DiaryRow & {
  media_assets: { id: string }[];
};

export async function deleteDiaryEntryAtomic(
  client: SupabaseClient<Database>,
  petId: string,
  entryId: string,
): Promise<DeletedDiaryRow | null> {
  let ambiguousAttempt = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await client.rpc("delete_diary_entry_v1", { p_pet_id: petId, p_entry_id: entryId });
      if (!error && data) {
        const { record, cleanupPaths } = decodeMediaCleanupEnvelope<DeletedDiaryRow>(data);
        await removeQueuedMediaObjects(client, cleanupPaths);
        return record;
      }
      if (ambiguousAttempt && error?.code === "P0002") return null;
      const failure = Object.assign(new Error(error?.message ?? "Diary entry deletion failed."), { code: error?.code });
      if (!isRetriableOfflineError(failure)) throw failure;
      ambiguousAttempt = true;
    } catch (error) {
      if (!isRetriableOfflineError(error)) throw error;
      ambiguousAttempt = true;
    }
  }

  throw new Error("Diary entry deletion could not be confirmed after retry.");
}
