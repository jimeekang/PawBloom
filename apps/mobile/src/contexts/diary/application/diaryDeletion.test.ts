import { deleteDiaryEntryAtomic } from "./diaryDeletion";

const calls: string[] = [];
const removed: string[] = [];
const client = {
  rpc: async (name: string, args?: { p_pet_id?: string; p_entry_id?: string }) => {
    calls.push(name);
    if (name === "delete_diary_entry_v1") {
      if (args?.p_pet_id !== "pet-1" || args.p_entry_id !== "entry-1") throw new Error("wrong diary delete scope");
      return {
        data: {
          record: {
            id: "entry-1",
            pet_id: "pet-1",
            category: "photo",
            client_mutation_id: "mutation-1",
            condition_score: null,
            created_at: "2026-07-12T00:00:00Z",
            created_by: "user-1",
            entry_date: "2026-07-12",
            occurred_at: "2026-07-12T00:00:00Z",
            record_origin: "diary",
            summary: "photo",
            superseded_by: null,
            updated_at: "2026-07-12T00:00:00Z",
            media_assets: [],
          },
          cleanup_paths: ["pet-1/diary/entry-1/1.jpg"],
        },
        error: null,
      };
    }
    return { data: 1, error: null };
  },
  storage: {
    from: () => ({
      remove: async (paths: string[]) => {
        removed.push(...paths);
        return { error: null };
      },
    }),
  },
};

const deleted = await deleteDiaryEntryAtomic(client as never, "pet-1", "entry-1");
if (deleted?.id !== "entry-1" || removed[0] !== "pet-1/diary/entry-1/1.jpg") {
  throw new Error("diary deletion must return the committed row and remove its queued Storage objects");
}
if (calls.join(",") !== "delete_diary_entry_v1,complete_media_cleanup_v1") {
  throw new Error("diary deletion must use the atomic RPC before acknowledging media cleanup");
}

let ambiguousAttempts = 0;
const ambiguousClient = {
  rpc: async () => {
    ambiguousAttempts += 1;
    if (ambiguousAttempts === 1) throw new TypeError("Network request failed");
    return { data: null, error: { code: "P0002", message: "Diary entry not found" } };
  },
};
const alreadyDeleted = await deleteDiaryEntryAtomic(ambiguousClient as never, "pet-1", "entry-1");
if (alreadyDeleted !== null || ambiguousAttempts !== 2) {
  throw new Error("a not-found retry after an ambiguous delete response must be treated as committed success");
}
