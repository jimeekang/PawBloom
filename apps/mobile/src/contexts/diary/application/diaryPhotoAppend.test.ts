import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { buildDiaryPhotoStoragePath } from "../../media/application/mediaUpload";
import { updatePhotoDiaryEntryAtomic } from "./diaryPhotoRecords";

const mutationId = "22222222-2222-4222-8222-222222222222";
const entryId = "11111111-1111-4111-8111-111111111111";
const expectedPath = buildDiaryPhotoStoragePath("pet-1", entryId, { uri: "file:///new.jpg" }, 1, mutationId);
const baseRow = {
  id: entryId,
  pet_id: "pet-1",
  category: "photo" as const,
  occurred_at: "2026-07-14T10:00:00.000Z",
  summary: "photo",
  condition_score: null,
  entry_date: "2026-07-14",
  record_origin: "diary",
  created_by: "user-1",
  client_mutation_id: entryId,
  created_at: "2026-07-14T10:00:00.000Z",
  updated_at: "2026-07-14T10:00:00.000Z",
  superseded_by: null,
};

await verifiesAppendUploadsAndCommitsNewPhoto();
await verifiesAppendRetrySkipsRegisteredUpload();
await verifiesRejectedAppendCleansNewObject();

async function verifiesAppendUploadsAndCommitsNewPhoto() {
  let uploadedNamespace: string | undefined;
  let rpcArgs: Record<string, unknown> | undefined;
  const client = fakeClient({ onRpc: (args) => { rpcArgs = args; return { data: baseRow, error: null }; } });
  const updated = await updatePhotoDiaryEntryAtomic({
    ...input(client),
    dependencies: {
      uploadPhoto: async (_client, _petId, _entryId, _photo, _index, namespace) => {
        uploadedNamespace = namespace;
        return { storagePath: expectedPath, contentType: "image/jpeg" };
      },
      removePhotos: async () => undefined,
    },
  });
  const media = rpcArgs?.p_media as { storage_path: string }[] | undefined;
  if (uploadedNamespace !== mutationId || media?.[0]?.storage_path !== expectedPath || updated.media_assets.length !== 2) {
    throw new Error("photo diary edit must upload and atomically append every newly selected photo");
  }
}

async function verifiesAppendRetrySkipsRegisteredUpload() {
  let uploads = 0;
  const client = fakeClient({ registeredPaths: [expectedPath] });
  await updatePhotoDiaryEntryAtomic({
    ...input(client),
    dependencies: {
      uploadPhoto: async () => { uploads += 1; return { storagePath: expectedPath, contentType: "image/jpeg" }; },
      removePhotos: async () => undefined,
    },
  });
  if (uploads !== 0) throw new Error("an ambiguous photo append retry must not overwrite an already registered object");
}

async function verifiesRejectedAppendCleansNewObject() {
  let removed: string[] = [];
  const client = fakeClient({ onRpc: () => ({ data: null, error: { code: "42501", message: "permission denied" } }) });
  try {
    await updatePhotoDiaryEntryAtomic({
      ...input(client),
      dependencies: {
        uploadPhoto: async () => ({ storagePath: expectedPath, contentType: "image/jpeg" }),
        removePhotos: async (_client, paths) => { removed = paths; },
      },
    });
    throw new Error("expected photo append rejection");
  } catch (error) {
    if (error instanceof Error && error.message === "expected photo append rejection") throw error;
  }
  if (removed[0] !== expectedPath) throw new Error("a rejected photo append must remove its unregistered uploaded object");
}

function input(client: SupabaseClient<Database>) {
  return {
    client,
    petId: "pet-1",
    entryId,
    appendMutationId: mutationId,
    input: {
      category: "photo" as const,
      summary: "",
      entryDate: "2026-07-14",
      occurredTime: "10:30",
      photos: [{ uri: "file:///new.jpg" }],
    },
  };
}

function fakeClient({
  registeredPaths = [],
  onRpc = () => ({ data: baseRow, error: null }),
}: {
  registeredPaths?: string[];
  onRpc?: (args: Record<string, unknown>) => { data: typeof baseRow | null; error: { code?: string; message: string } | null };
}) {
  const mediaQuery = {
    select: () => mediaQuery,
    eq: () => mediaQuery,
    in: async () => ({ data: registeredPaths.map((storage_path) => ({ storage_path })), error: null }),
  };
  const diaryQuery = {
    select: () => diaryQuery,
    eq: () => diaryQuery,
    is: () => diaryQuery,
    maybeSingle: async () => ({
      data: { ...baseRow, media_assets: [{ id: "asset-old", storage_path: "old.jpg" }, { id: "asset-new", storage_path: expectedPath }] },
      error: null,
    }),
  };
  return {
    from: (table: string) => table === "media_assets" ? mediaQuery : diaryQuery,
    rpc: async (_name: string, args: Record<string, unknown>) => onRpc(args),
  } as unknown as SupabaseClient<Database>;
}
