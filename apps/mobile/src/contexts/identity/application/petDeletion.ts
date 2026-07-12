import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { decodeMediaCleanupEnvelope, removeQueuedMediaObjects } from "../../media/application/mediaCleanup";
import { isRetriableOfflineError } from "../../sync/application/offlineErrorPolicy";

export async function deletePetRow(client: SupabaseClient<Database>, petId: string): Promise<void> {
  let ambiguousAttempt = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await client.rpc("delete_pet_v1", { p_pet_id: petId });
      if (!error && data) {
        const { cleanupPaths } = decodeMediaCleanupEnvelope<{ id: string }>(data);
        await removeQueuedMediaObjects(client, cleanupPaths);
        return;
      }
      if (ambiguousAttempt && error?.code === "P0002") return;
      const failure = Object.assign(new Error(error?.message ?? "반려동물 프로필을 삭제하지 못했습니다."), { code: error?.code });
      if (!isRetriableOfflineError(failure)) throw failure;
      ambiguousAttempt = true;
    } catch (error) {
      if (!isRetriableOfflineError(error)) throw error;
      ambiguousAttempt = true;
    }
  }

  throw new Error("반려동물 프로필 삭제 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
}
