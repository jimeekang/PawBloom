import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { createPhotoDiaryEntryAtomic } from "./diaryPhotoRecords";

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  pet_id: "pet-1",
  category: "photo" as const,
  occurred_at: "2026-07-12T08:00:00.000Z",
  summary: "photo",
  condition_score: null,
  entry_date: "2026-07-12",
  record_origin: "diary" as const,
  created_by: "user-1",
  client_mutation_id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-07-12T08:00:00.000Z",
  updated_at: "2026-07-12T08:00:00.000Z",
};

await verifiesExistingIdempotentResultSkipsUpload();
await verifiesAtomicRpcReceivesEveryUploadedObject();
await verifiesConcurrentIdempotentWinnerIsNotCleaned();
await verifiesRejectedSaveCleansUploadedObjects();
await verifiesAmbiguousNetworkFailureKeepsRetryableObjects();

async function verifiesExistingIdempotentResultSkipsUpload() {
  let uploads = 0;
  const client = fakeClient({ existing: { ...baseRow, media_assets: [{ id: "asset-1" }] } });
  const saved = await createPhotoDiaryEntryAtomic({
    ...input(client),
    dependencies: {
      uploadPhoto: async () => { uploads += 1; return { storagePath: "unexpected", contentType: "image/jpeg" }; },
      removePhotos: async () => undefined,
    },
  });
  if (uploads !== 0 || saved.media_assets.length !== 1) throw new Error("an idempotent photo retry must reuse the committed diary entry without re-uploading");
}

async function verifiesAtomicRpcReceivesEveryUploadedObject() {
  const rpcCalls: Record<string, unknown>[] = [];
  const client = fakeClient({ onRpc: (args) => { rpcCalls.push(args); return { data: baseRow, error: null }; } });
  const saved = await createPhotoDiaryEntryAtomic({
    ...input(client),
    dependencies: {
      uploadPhoto: async (_client, _petId, _entryId, _photo, index) => ({ storagePath: `pet-1/diary/entry-1/${index}.jpg`, contentType: "image/jpeg" }),
      removePhotos: async () => undefined,
    },
  });
  const media = rpcCalls[0]?.p_media as { storage_path: string }[] | undefined;
  if (media?.length !== 2 || saved.media_assets.length !== 2) throw new Error("the database RPC must atomically receive and return every uploaded photo");
}

async function verifiesRejectedSaveCleansUploadedObjects() {
  let removed: string[] = [];
  const client = fakeClient({ onRpc: () => ({ data: null, error: { code: "42501", message: "permission denied" } }) });
  try {
    await createPhotoDiaryEntryAtomic({
      ...input(client),
      dependencies: {
        uploadPhoto: async (_client, _petId, _entryId, _photo, index) => ({ storagePath: `uploaded-${index}`, contentType: "image/jpeg" }),
        removePhotos: async (_client, paths) => { removed = paths; },
      },
    });
    throw new Error("expected rejected photo diary save");
  } catch (error) {
    if (error instanceof Error && error.message === "expected rejected photo diary save") throw error;
  }
  if (removed.join(",") !== "uploaded-1,uploaded-2") throw new Error("a rejected atomic save must remove every object uploaded for that attempt");
}

async function verifiesConcurrentIdempotentWinnerIsNotCleaned() {
  let cleanupCalled = false;
  const client = fakeClient({
    existingAfterRpc: { ...baseRow, media_assets: [{ id: "asset-winner" }] },
    onRpc: () => ({ data: null, error: { code: "23505", message: "duplicate client mutation" } }),
  });
  const saved = await createPhotoDiaryEntryAtomic({
    ...input(client),
    dependencies: {
      uploadPhoto: async (_client, _petId, _entryId, _photo, index) => ({ storagePath: `winner-${index}`, contentType: "image/jpeg" }),
      removePhotos: async () => { cleanupCalled = true; },
    },
  });
  if (cleanupCalled || saved.media_assets[0]?.id !== "asset-winner") {
    throw new Error("a concurrent idempotent loser must reuse the committed winner without deleting its deterministic objects");
  }
}

async function verifiesAmbiguousNetworkFailureKeepsRetryableObjects() {
  let cleanupCalled = false;
  const client = fakeClient({ onRpc: () => ({ data: null, error: { message: "Network request failed" } }) });
  try {
    await createPhotoDiaryEntryAtomic({
      ...input(client),
      dependencies: {
        uploadPhoto: async (_client, _petId, _entryId, _photo, index) => ({ storagePath: `retry-${index}`, contentType: "image/jpeg" }),
        removePhotos: async () => { cleanupCalled = true; },
      },
    });
  } catch {
    // The caller keeps the form and retries with the same client mutation id.
  }
  if (cleanupCalled) throw new Error("an ambiguous network response must keep deterministic objects available for idempotent retry");
}

function input(client: SupabaseClient<Database>) {
  return {
    client,
    petId: "pet-1",
    entryId: "11111111-1111-4111-8111-111111111111",
    clientMutationId: "11111111-1111-4111-8111-111111111111",
    input: {
      category: "photo" as const,
      summary: "",
      entryDate: "2026-07-12",
      occurredTime: "08:00",
      photos: [{ uri: "file:///one.jpg" }, { uri: "file:///two.jpg" }],
    },
  };
}

function fakeClient({
  existing = null,
  existingAfterRpc = null,
  onRpc = () => ({ data: baseRow, error: null }),
}: {
  existing?: (typeof baseRow & { media_assets: { id: string }[] }) | null;
  existingAfterRpc?: (typeof baseRow & { media_assets: { id: string }[] }) | null;
  onRpc?: (args: Record<string, unknown>) => { data: typeof baseRow | null; error: { code?: string; message: string } | null };
}) {
  let rpcCalled = false;
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    maybeSingle: async () => ({ data: rpcCalled ? existingAfterRpc : existing, error: null }),
  };
  return {
    from: () => query,
    rpc: async (_name: string, args: Record<string, unknown>) => { rpcCalled = true; return onRpc(args); },
  } as unknown as SupabaseClient<Database>;
}
