import {
  clearDeletingUserOwnership,
  readAccountDeletionStorageState,
} from "../../../../../../supabase/functions/delete-account/storage";

const calls: string[] = [];
let ownedObjectRead = 0;
let rehomeAttempt = 0;
const client = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push(`rpc:${name}`);
    if (name === "list_account_deletion_registered_objects_v1") {
      ownedObjectRead += 1;
      return {
        data: ownedObjectRead <= 2
          ? [{ bucket_id: "pet-media", name: "pet-1/diary/entry/photo.jpg", media_asset_id: "asset-1" }]
          : [],
        error: null,
      };
    }
    if (name === "rehome_account_deletion_media_v1") {
      rehomeAttempt += 1;
      calls.push(`rehome-destination:${String(args.p_destination_path)}`);
      return rehomeAttempt === 1
        ? { data: null, error: null }
        : { data: null, error: new Error("registered media changed") };
    }
    if (name === "list_account_deletion_temporary_objects_v1") return { data: [], error: null };
    if (name === "account_deletion_storage_state_v1") {
      return {
        data: {
          registered_user_owned_count: 0,
          user_owned_count: 1,
          owned_pet_object_count: 2,
          temporary_object_count: 0,
        },
        error: null,
      };
    }
    return { data: null, error: null };
  },
  storage: {
    from: (bucket: string) => ({
      copy: async (source: string, destination: string) => {
        calls.push(`copy:${bucket}:${source}->${destination}`);
        return { data: { path: destination }, error: null };
      },
      remove: async (paths: string[]) => {
        calls.push(`remove:${bucket}:${paths.join(",")}`);
        return { data: paths, error: null };
      },
    }),
  },
};

async function verifyStorageOrchestration() {
  const workers = await Promise.allSettled([
    clearDeletingUserOwnership(client as never, "user-1", "job-1"),
    clearDeletingUserOwnership(client as never, "user-1", "job-1"),
  ]);
  if (workers.filter((worker) => worker.status === "fulfilled").length !== 1
    || workers.filter((worker) => worker.status === "rejected").length !== 1) {
    throw new Error("parallel deletion workers must converge with one metadata winner and one retryable loser");
  }

  const copyCalls = calls.filter((call) => call.startsWith("copy:pet-media:pet-1/diary/entry/photo.jpg->"));
  const destinations = copyCalls.map((call) => call.split("->")[1]);
  if (copyCalls.length !== 2 || new Set(destinations).size !== 2) {
    throw new Error("parallel re-home attempts must always use unique destinations");
  }
  if (!destinations.every((destination) =>
    /^pet-1\/diary\/entry\/\.account-deletion\/job-1\/asset-1\/[^/]+\/photo\.jpg$/.test(destination ?? ""))) {
    throw new Error("registered media must use a unique job/asset/attempt-scoped destination");
  }
  if (calls.some((call) => call.startsWith("remove:pet-media:"))) {
    throw new Error("pre-Auth re-home must retain every original and must never delete another worker's destination");
  }

  const state = await readAccountDeletionStorageState(client as never, "user-1");
  if (state.registered_user_owned_count !== 0 || state.user_owned_count !== 1
    || state.owned_pet_object_count !== 2 || state.temporary_object_count !== 0) {
    throw new Error("account deletion Storage counts must decode without losing numeric state");
  }

  console.log("account deletion Storage orchestration verified");
}

export default verifyStorageOrchestration();
