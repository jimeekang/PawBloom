import type { PersistedPet } from "./authContextQueries";
import { deletePetRow } from "./authContextQueries";

async function canDeletePet(client: Parameters<typeof deletePetRow>[0], pet: PersistedPet) {
  await deletePetRow(client, pet.id);
}

void canDeletePet;

const rpcCalls: string[] = [];
const removedPaths: string[] = [];
const client = {
  rpc: async (name: string, args?: { p_storage_paths?: string[] }) => {
    rpcCalls.push(name);
    if (name === "delete_pet_v1") {
      return {
        data: { record: { id: "pet-1" }, cleanup_paths: ["pet-1/profile/photo.jpg", "pet-1/diary/entry/1.jpg"] },
        error: null,
      };
    }
    if (name === "complete_media_cleanup_v1") return { data: args?.p_storage_paths?.length ?? 0, error: null };
    throw new Error(`unexpected rpc: ${name}`);
  },
  storage: {
    from: () => ({
      remove: async (paths: string[]) => {
        removedPaths.push(...paths);
        return { error: null };
      },
    }),
  },
};

await deletePetRow(client as never, "pet-1");
if (rpcCalls[0] !== "delete_pet_v1" || rpcCalls[1] !== "complete_media_cleanup_v1") {
  throw new Error("pet deletion must commit the DB delete before acknowledging Storage cleanup");
}
if (removedPaths.length !== 2 || removedPaths.some((path) => !path.startsWith("pet-1/"))) {
  throw new Error("pet deletion must remove every queued object for the deleted pet");
}

let ambiguousAttempts = 0;
const ambiguousClient = {
  rpc: async () => {
    ambiguousAttempts += 1;
    if (ambiguousAttempts === 1) throw new TypeError("Network request failed");
    return { data: null, error: { code: "P0002", message: "Pet not found" } };
  },
};
await deletePetRow(ambiguousClient as never, "pet-1");
if (ambiguousAttempts !== 2) {
  throw new Error("a not-found retry after an ambiguous pet delete response must be treated as committed success");
}
