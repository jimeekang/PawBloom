import { decodeMediaCleanupEnvelope, removeQueuedMediaObjects, retryPendingMediaCleanup } from "./mediaCleanup";

const decoded = decodeMediaCleanupEnvelope<{ id: string }>({
  record: { id: "record-1" },
  cleanup_paths: ["pet-1/a.jpg", "pet-1/a.jpg", "pet-1/b.jpg", 42],
});
if (decoded.record.id !== "record-1" || decoded.cleanupPaths.join(",") !== "pet-1/a.jpg,pet-1/b.jpg") {
  throw new Error("cleanup envelopes must validate their record and deduplicate valid storage paths");
}

const storageBatches: string[][] = [];
const completedBatches: string[][] = [];
const batchClient = {
  storage: {
    from: () => ({
      remove: async (paths: string[]) => {
        storageBatches.push(paths);
        return { error: null };
      },
    }),
  },
  rpc: async (_name: string, args: { p_storage_paths: string[] }) => {
    completedBatches.push(args.p_storage_paths);
    return { data: args.p_storage_paths.length, error: null };
  },
};

const manyPaths = Array.from({ length: 1_001 }, (_, index) => `pet-1/diary/entry/${index}.jpg`);
await removeQueuedMediaObjects(batchClient as never, manyPaths);
if (storageBatches.length !== 2 || storageBatches[0]?.length !== 1_000 || storageBatches[1]?.length !== 1) {
  throw new Error("Storage cleanup must respect the 1000-object API batch limit");
}
if (completedBatches.flat().length !== manyPaths.length) {
  throw new Error("only successfully removed Storage batches should be acknowledged");
}

let completionAttempted = false;
const failingStorageClient = {
  storage: { from: () => ({ remove: async () => ({ error: { message: "offline" } }) }) },
  rpc: async () => {
    completionAttempted = true;
    return { data: 0, error: null };
  },
};
await removeQueuedMediaObjects(failingStorageClient as never, ["pet-1/profile/old.jpg"]);
if (completionAttempted) throw new Error("failed Storage deletion must remain queued for retry");

const retryCalls: string[] = [];
const retriedStoragePaths: string[] = [];
const agedDiaryOrphanPath = "pet-2/diary/5d2e88aa-eeca-43d5-89fa-661251d67fe4/1-photo.jpg";
const retryClient = {
  rpc: async (name: string) => {
    retryCalls.push(name);
    if (name === "list_pending_media_cleanup_v1") return { data: [agedDiaryOrphanPath], error: null };
    return { data: 1, error: null };
  },
  storage: {
    from: () => ({
      remove: async (paths: string[]) => {
        retriedStoragePaths.push(...paths);
        return { error: null };
      },
    }),
  },
};
await retryPendingMediaCleanup(retryClient as never);
if (retryCalls.join(",") !== "list_pending_media_cleanup_v1,complete_media_cleanup_v1") {
  throw new Error("session cleanup retry must list durable work, remove Storage objects, and acknowledge completion");
}
if (retriedStoragePaths.join(",") !== agedDiaryOrphanPath) {
  throw new Error("session cleanup retry must process aged diary orphans discovered by the authenticated RPC");
}
