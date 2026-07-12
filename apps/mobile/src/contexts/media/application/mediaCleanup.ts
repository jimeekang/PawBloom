import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../../shared-kernel/supabase/database.types";

const STORAGE_REMOVE_BATCH_SIZE = 1_000;

export type MediaCleanupEnvelope<T> = {
  record: T;
  cleanupPaths: string[];
};

export function decodeMediaCleanupEnvelope<T>(value: Json | null): MediaCleanupEnvelope<T> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Invalid media cleanup response.");
  }

  const record = value.record;
  if (!record || Array.isArray(record) || typeof record !== "object") {
    throw new Error("Invalid media cleanup record.");
  }

  const cleanupPaths = Array.isArray(value.cleanup_paths)
    ? value.cleanup_paths.filter((path): path is string => typeof path === "string" && path.length > 0)
    : [];

  return { record: record as T, cleanupPaths: [...new Set(cleanupPaths)] };
}

export async function removeQueuedMediaObjects(
  client: SupabaseClient<Database>,
  storagePaths: string[],
): Promise<void> {
  const uniquePaths = [...new Set(storagePaths.filter(Boolean))];
  for (let index = 0; index < uniquePaths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = uniquePaths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    try {
      const { error } = await client.storage.from("pet-media").remove(batch);
      if (error) continue;
      await client.rpc("complete_media_cleanup_v1", { p_storage_paths: batch });
    } catch {
      // The durable DB queue intentionally keeps this batch available for retry.
    }
  }
}

export async function retryPendingMediaCleanup(client: SupabaseClient<Database>): Promise<void> {
  try {
    const { data, error } = await client.rpc("list_pending_media_cleanup_v1");
    if (error || !Array.isArray(data)) return;
    await removeQueuedMediaObjects(
      client,
      data.filter((path): path is string => typeof path === "string" && path.length > 0),
    );
  } catch {
    // Cleanup is retried on a later authenticated session without blocking sign-in.
  }
}
