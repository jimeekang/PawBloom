import {
  clearMemoryOwnership,
  drainResourceCleanup,
  rollbackAccountDeletion,
  type AccountDeletionStorageClient,
} from "../functions/delete-account/storage";

async function testResourceWorker() {
  const calls: string[] = [];
  let inventoryPass = 0;
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(`${name}:${String(args.p_storage_path ?? "")}`);
      if (name === "list_pending_resource_cleanup_v1") return {
        data: [
          { bucket_id: "memory-media", storage_path: "memory/ok" },
          { bucket_id: "pet-avatars", storage_path: "pet/retry" },
          { bucket_id: "pet-avatars", storage_path: "pet/gone" },
          { bucket_id: "pet-avatars", storage_path: "pet/gone-numeric" },
          { bucket_id: "pet-avatars", storage_path: "pet/forbidden" },
          { bucket_id: "pet-avatars", storage_path: "pet/server" },
        ], error: null,
      };
      if (name === "list_account_deletion_memory_objects_v2") return {
        data: inventoryPass++ === 0
          ? [{ bucket_id: "memory-media", name: "memory/mutation/asset", media_asset_id: "asset" }]
          : [], error: null,
      };
      if (name === "list_account_deletion_memory_rehomes_v2") return {
        data: [{ media_asset_id: "asset", source_path: "original", destination_path: "copy" }], error: null,
      };
      if (name === "rollback_account_deletion_memory_v2") return { data: null, error: new Error("original unavailable") };
      return { data: null, error: null };
    },
    storage: { from: (bucket: string) => ({
      remove: async (paths: string[]) => {
        calls.push(`remove:${bucket}:${paths.join(",")}`);
        return { error: paths.includes("pet/retry") ? new Error("Storage unavailable") : paths.includes("pet/gone") ? { statusCode: "404" } : paths.includes("pet/gone-numeric") ? { status: 404 } : paths.includes("pet/forbidden") ? { status: 403 } : paths.includes("pet/server") ? { statusCode: 503 } : null };
      },
      copy: async (source: string, destination: string) => {
        calls.push(`copy:${bucket}:${source}:${destination}`);
        return { error: null };
      },
      list: async () => ({ data: [], error: null }),
    }) },
  } satisfies AccountDeletionStorageClient;
  const result = await drainResourceCleanup(client);
  if (result.completed !== 3 || result.failed !== 3) throw new Error("cleanup must retain a retryable failure");
  if (!calls.includes("complete_resource_cleanup_v1:memory/ok")
    || !calls.includes("complete_resource_cleanup_v1:pet/gone")
    || !calls.includes("complete_resource_cleanup_v1:pet/gone-numeric")
    || calls.includes("complete_resource_cleanup_v1:pet/forbidden")
    || calls.includes("complete_resource_cleanup_v1:pet/server")
    || calls.includes("complete_resource_cleanup_v1:pet/retry")) throw new Error("worker ACKed failed Storage removal");
  if (!calls[0]?.startsWith("expire_memory_drafts_v1")) throw new Error("draft expiry must feed the cleanup inventory");

  calls.length = 0;
  await clearMemoryOwnership(client, "contributor", "deletion-job");
  if (!calls.some((call) => call.startsWith("copy:memory-media:memory/mutation/asset:memory/deletion-job/"))
    || !calls.some((call) => call.startsWith("rehome_account_deletion_memory_v2"))) throw new Error("memory rehome contract changed");
  const intentIndex = calls.findIndex((call) => call.startsWith("prepare_account_deletion_memory_rehome_v2"));
  const copyIndex = calls.findIndex((call) => call.startsWith("copy:memory-media:"));
  const finalizeIndex = calls.findIndex((call) => call.startsWith("rehome_account_deletion_memory_v2"));
  if (intentIndex < 0 || intentIndex >= copyIndex || copyIndex >= finalizeIndex) throw new Error("rehome must reserve intent before copying and finalize after copying");
  if (calls.some((call) => call.startsWith("remove:"))) throw new Error("pre-Auth preparation removed original bytes");

  calls.length = 0;
  let failed = false;
  try { await rollbackAccountDeletion(client, "contributor"); } catch { failed = true; }
  if (!failed || calls.some((call) => call.startsWith("remove:"))
    || calls.some((call) => call.startsWith("cancel_account_deletion_v1"))) throw new Error("rollback discarded a copy before restoring metadata");
  console.log("resource cleanup retries and memory ownership preparation/rollback verified");
}

export default testResourceWorker();
