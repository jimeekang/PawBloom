const PET_MEDIA_BUCKET = "pet-media";
const STORAGE_BATCH_SIZE = 100;
const MAX_OWNER_CLEAR_PASSES = 100;

// Structural subset shared by the Edge runtime and the deterministic unit
// test. Keeping this adapter free of Deno URL imports lets the mobile TypeScript
// gate validate the deletion orchestration as ordinary platform-neutral code.
export type AccountDeletionStorageClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  storage: {
    from: (bucket: string) => {
      copy: (source: string, destination: string) => Promise<{ error: unknown }>;
      remove: (paths: string[]) => Promise<{ error: unknown }>;
      list: (
        prefix: string,
        options: { limit: number; offset: number },
      ) => Promise<{ data: Array<{ id: string | null; name: string }> | null; error: unknown }>;
    };
  };
};

export type AccountDeletionJob = {
  job_id: string;
  status: "preparing" | "auth_deleted";
  owned_pet_ids: string[];
};

export type PendingAccountDeletionJob = AccountDeletionJob & { user_id: string; updated_at: string };

export async function claimAccountDeletionOperation(supabase: AccountDeletionStorageClient, userId: string, operationId: string) {
  const { data, error } = await supabase.rpc("claim_account_deletion_operation_v1", {
    p_user_id: userId, p_operation_id: operationId,
  });
  if (error) throw error;
  return data === true;
}

export async function releaseAccountDeletionOperation(supabase: AccountDeletionStorageClient, userId: string, operationId: string) {
  const { error } = await supabase.rpc("release_account_deletion_operation_v1", {
    p_user_id: userId, p_operation_id: operationId,
  });
  if (error) console.error("Account deletion operation lease release failed", error);
}

type OwnedObject = {
  bucket_id: string;
  name: string;
  media_asset_id: string | null;
};

type StorageState = {
  registered_user_owned_count: number;
  user_owned_count: number;
  owned_pet_object_count: number;
  temporary_object_count: number;
};

export async function getAccountDeletionJob(supabase: AccountDeletionStorageClient, userId: string) {
  const { data, error } = await supabase.rpc("get_account_deletion_job_v1", { p_user_id: userId });
  if (error) throw error;
  return data ? decodeJob(data) : null;
}

export async function beginAccountDeletion(supabase: AccountDeletionStorageClient, userId: string) {
  const { data, error } = await supabase.rpc("begin_account_deletion_v1", { p_user_id: userId });
  if (error) throw error;
  return decodeJob(data);
}

export async function clearDeletingUserOwnership(
  supabase: AccountDeletionStorageClient,
  userId: string,
  jobId: string,
) {
  for (let pass = 0; pass < MAX_OWNER_CLEAR_PASSES; pass += 1) {
    const objects = await listRegisteredOwnedObjects(supabase, userId);
    if (objects.length === 0) {
      await removeUnregisteredRehomeObjects(supabase, userId);
      return;
    }

    for (const object of objects) {
      if (object.bucket_id !== PET_MEDIA_BUCKET || !object.media_asset_id) {
        throw new Error("Invalid registered Storage object returned by the database.");
      }
      await rehomeRegisteredMedia(supabase, userId, jobId, {
        ...object,
        media_asset_id: object.media_asset_id,
      });
    }
  }

  throw new Error("Account deletion could not clear Storage ownership within the safety limit.");
}

export async function removeDeletingUserOwnedObjects(
  supabase: AccountDeletionStorageClient,
  userId: string,
) {
  for (let pass = 0; pass < MAX_OWNER_CLEAR_PASSES; pass += 1) {
    const objects = await listOwnedObjects(supabase, userId);
    if (objects.length === 0) return;
    const byBucket = new Map<string, string[]>();
    for (const object of objects) {
      const paths = byBucket.get(object.bucket_id) ?? [];
      paths.push(object.name);
      byBucket.set(object.bucket_id, paths);
    }
    for (const [bucket, paths] of byBucket) await removeObjects(supabase, bucket, paths);
  }
  throw new Error("Account deletion could not remove user-owned Storage within the safety limit.");
}

export async function purgeOwnedPetMedia(supabase: AccountDeletionStorageClient, petIds: string[]) {
  for (const petId of petIds) await purgePetMedia(supabase, petId);
}

export async function removeUnregisteredRehomeObjects(supabase: AccountDeletionStorageClient, userId: string) {
  const { data, error } = await supabase.rpc("list_account_deletion_temporary_objects_v1", {
    p_user_id: userId,
  });
  if (error) throw error;

  const byBucket = new Map<string, string[]>();
  for (const raw of Array.isArray(data) ? data : []) {
    const object = raw as { bucket_id?: unknown; name?: unknown };
    if (typeof object.bucket_id !== "string" || typeof object.name !== "string") {
      throw new Error("Invalid temporary Storage object returned by the database.");
    }
    const paths = byBucket.get(object.bucket_id) ?? [];
    paths.push(object.name);
    byBucket.set(object.bucket_id, paths);
  }

  for (const [bucket, paths] of byBucket) await removeObjects(supabase, bucket, paths);
}

export async function readAccountDeletionStorageState(supabase: AccountDeletionStorageClient, userId: string) {
  const { data, error } = await supabase.rpc("account_deletion_storage_state_v1", {
    p_user_id: userId,
  });
  if (error) throw error;
  const state = data as Partial<Record<keyof StorageState, unknown>> | null;
  return {
    registered_user_owned_count: decodeCount(state?.registered_user_owned_count),
    user_owned_count: decodeCount(state?.user_owned_count),
    owned_pet_object_count: decodeCount(state?.owned_pet_object_count),
    temporary_object_count: decodeCount(state?.temporary_object_count),
  } satisfies StorageState;
}

export async function rollbackAccountDeletion(
  supabase: AccountDeletionStorageClient,
  userId: string,
) {
  await rollbackMemoryOwnership(supabase, userId);
  for (let pass = 0; pass < MAX_OWNER_CLEAR_PASSES; pass += 1) {
    const rehomes = await listRehomes(supabase, userId);
    if (rehomes.length === 0) {
      await removeUnregisteredRehomeObjects(supabase, userId);
      const { error } = await supabase.rpc("cancel_account_deletion_v1", { p_user_id: userId });
      if (error) throw error;
      return;
    }
    for (const rehome of rehomes) {
      const { data, error } = await supabase.rpc("rollback_account_deletion_rehome_v1", {
        p_user_id: userId,
        p_media_asset_id: rehome.media_asset_id,
      });
      if (error) throw error;
      const destination = typeof data === "string" ? data : rehome.destination_path;
      await removeObjects(supabase, PET_MEDIA_BUCKET, [destination]);
    }
  }
  throw new Error("Account deletion rollback exceeded the safety limit.");
}

export async function listPendingAccountDeletionJobs(supabase: AccountDeletionStorageClient) {
  const { data, error } = await supabase.rpc("list_pending_account_deletion_jobs_v1", { p_limit: 25 });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(decodePendingJob);
}

export async function recordAccountDeletionFailure(
  supabase: AccountDeletionStorageClient,
  userId: string,
  errorMessage: string,
) {
  const { error } = await supabase.rpc("record_account_deletion_failure_v1", {
    p_user_id: userId,
    p_error: errorMessage,
  });
  if (error) throw error;
}

export async function markAuthDeleted(supabase: AccountDeletionStorageClient, userId: string) {
  const { error } = await supabase.rpc("mark_account_deletion_auth_deleted_v1", { p_user_id: userId });
  if (error) throw error;
}

export async function completeAccountDeletion(supabase: AccountDeletionStorageClient, userId: string) {
  const { error } = await supabase.rpc("complete_account_deletion_v1", { p_user_id: userId });
  if (error) throw error;
}

async function listOwnedObjects(supabase: AccountDeletionStorageClient, userId: string) {
  const { data, error } = await supabase.rpc("list_account_deletion_objects_v1", {
    p_user_id: userId,
    p_limit: STORAGE_BATCH_SIZE,
  });
  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((raw) => {
    const object = raw as Partial<Record<keyof OwnedObject, unknown>>;
    if (typeof object.bucket_id !== "string" || typeof object.name !== "string"
      || (object.media_asset_id !== null && typeof object.media_asset_id !== "string")) {
      throw new Error("Invalid Storage ownership row returned by the database.");
    }
    return object as OwnedObject;
  });
}

async function listRegisteredOwnedObjects(supabase: AccountDeletionStorageClient, userId: string) {
  const { data, error } = await supabase.rpc("list_account_deletion_registered_objects_v1", {
    p_user_id: userId,
    p_limit: STORAGE_BATCH_SIZE,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((raw) => {
    const object = raw as Partial<Record<keyof OwnedObject, unknown>>;
    if (typeof object.bucket_id !== "string" || typeof object.name !== "string"
      || typeof object.media_asset_id !== "string") {
      throw new Error("Invalid registered Storage ownership row returned by the database.");
    }
    return object as OwnedObject;
  });
}

async function listRehomes(supabase: AccountDeletionStorageClient, userId: string) {
  const { data, error } = await supabase.rpc("list_account_deletion_rehomes_v1", { p_user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((raw) => {
    const row = raw as { media_asset_id?: unknown; source_path?: unknown; destination_path?: unknown };
    if (typeof row.media_asset_id !== "string" || typeof row.source_path !== "string"
      || typeof row.destination_path !== "string") {
      throw new Error("Invalid account deletion media rollback row.");
    }
    return row as { media_asset_id: string; source_path: string; destination_path: string };
  });
}

async function rehomeRegisteredMedia(
  supabase: AccountDeletionStorageClient,
  userId: string,
  jobId: string,
  object: OwnedObject & { media_asset_id: string },
) {
  const destination = buildRehomePath(object.name, jobId, object.media_asset_id, crypto.randomUUID());

  const { error: copyError } = await supabase.storage
    .from(object.bucket_id)
    .copy(object.name, destination);
  if (copyError) throw copyError;

  const { error: rehomeError } = await supabase.rpc("rehome_account_deletion_media_v1", {
    p_user_id: userId,
    p_media_asset_id: object.media_asset_id,
    p_source_path: object.name,
    p_destination_path: destination,
  });
  // A network error may arrive after the database committed the path swap.
  // Keep both complete copies on an ambiguous result; the next inventory pass
  // safely distinguishes a registered destination from an unregistered one.
  if (rehomeError) throw rehomeError;

  // Keep the original bytes until Auth deletion succeeds. If Auth rejects the
  // delete, the durable mapping lets us atomically restore the original path.
}

function buildRehomePath(source: string, jobId: string, mediaAssetId: string, attemptId: string) {
  const slash = source.lastIndexOf("/");
  if (slash <= 0 || slash === source.length - 1) {
    throw new Error("Registered media has an invalid Storage path.");
  }
  const parent = source.slice(0, slash);
  const fileName = source.slice(slash + 1);
  return `${parent}/.account-deletion/${jobId}/${mediaAssetId}/${attemptId}/${fileName}`;
}

async function purgePetMedia(supabase: AccountDeletionStorageClient, petId: string): Promise<void> {
  const prefixes = [petId];

  while (prefixes.length > 0) {
    const prefix = prefixes.pop() as string;
    const files: string[] = [];
    let offset = 0;

    for (;;) {
      const { data: entries, error } = await supabase.storage
        .from(PET_MEDIA_BUCKET)
        .list(prefix, { limit: STORAGE_BATCH_SIZE, offset });
      if (error) throw error;
      if (!entries || entries.length === 0) break;

      for (const entry of entries as Array<{ id: string | null; name: string }>) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) prefixes.push(path);
        else files.push(path);
      }
      if (entries.length < STORAGE_BATCH_SIZE) break;
      offset += entries.length;
    }

    await removeObjects(supabase, PET_MEDIA_BUCKET, files);
  }
}

async function removeObjects(supabase: AccountDeletionStorageClient, bucket: string, paths: string[]) {
  for (let start = 0; start < paths.length; start += STORAGE_BATCH_SIZE) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove(paths.slice(start, start + STORAGE_BATCH_SIZE));
    const status = error && typeof error === "object"
      ? String((error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status)
      : null;
    if (error && status !== "404") throw error;
  }
}

function decodeJob(value: unknown): AccountDeletionJob {
  const job = value as Partial<AccountDeletionJob> | null;
  if (!job || typeof job.job_id !== "string"
    || (job.status !== "preparing" && job.status !== "auth_deleted")
    || !Array.isArray(job.owned_pet_ids)
    || !job.owned_pet_ids.every((petId) => typeof petId === "string")) {
    throw new Error("Invalid account deletion job returned by the database.");
  }
  return job as AccountDeletionJob;
}

function decodePendingJob(value: unknown): PendingAccountDeletionJob {
  const row = value as { user_id?: unknown; updated_at?: unknown } & Partial<AccountDeletionJob>;
  if (typeof row.user_id !== "string" || typeof row.updated_at !== "string") {
    throw new Error("Invalid pending account deletion job metadata.");
  }
  return { user_id: row.user_id, updated_at: row.updated_at, ...decodeJob(row) };
}

function decodeCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid account deletion Storage count.");
  return count;
}


export async function clearMemoryOwnership(supabase: AccountDeletionStorageClient, userId: string, jobId: string) {
  for (let pass = 0; pass < MAX_OWNER_CLEAR_PASSES; pass += 1) {
    const { data, error } = await supabase.rpc("list_account_deletion_memory_objects_v2", {
      p_user_id: userId, p_limit: STORAGE_BATCH_SIZE,
    });
    if (error) throw error;
    const objects = decodeMemoryObjects(data);
    if (objects.length === 0) return;
    for (const object of objects) {
      const destination = `${object.name.split("/")[0]}/${jobId}/${crypto.randomUUID()}`;
      const { error: intentError } = await supabase.rpc("prepare_account_deletion_memory_rehome_v2", {
        p_user_id: userId, p_media_asset_id: object.media_asset_id,
        p_source_path: object.name, p_destination_path: destination,
      });
      if (intentError) throw intentError;
      const { error: copyError } = await supabase.storage.from("memory-media").copy(object.name, destination);
      if (copyError) throw copyError;
      const { error: rehomeError } = await supabase.rpc("rehome_account_deletion_memory_v2", {
        p_user_id: userId, p_media_asset_id: object.media_asset_id,
        p_source_path: object.name, p_destination_path: destination,
      });
      // An ambiguous response keeps both copies for durable inventory/rollback.
      if (rehomeError) throw rehomeError;
    }
  }
  throw new Error("Account deletion memory ownership preparation exceeded the safety limit.");
}

async function rollbackMemoryOwnership(supabase: AccountDeletionStorageClient, userId: string) {
  for (let pass = 0; pass < MAX_OWNER_CLEAR_PASSES; pass += 1) {
    const { data, error } = await supabase.rpc("list_account_deletion_memory_rehomes_v2", { p_user_id: userId });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Invalid memory rollback inventory.");
    if (data.length === 0) return;
    for (const raw of data) {
      const row = raw as { media_asset_id?: unknown; destination_path?: unknown };
      if (typeof row.media_asset_id !== "string" || typeof row.destination_path !== "string") {
        throw new Error("Invalid memory rollback row.");
      }
      const { data: destination, error: rollbackError } = await supabase.rpc("rollback_account_deletion_memory_v2", {
        p_user_id: userId, p_media_asset_id: row.media_asset_id,
      });
      if (rollbackError) throw rollbackError;
      await removeObjects(supabase, "memory-media", [typeof destination === "string" ? destination : row.destination_path]);
    }
  }
  throw new Error("Account deletion memory rollback exceeded the safety limit.");
}

function decodeMemoryObjects(data: unknown) {
  if (!Array.isArray(data)) throw new Error("Invalid memory ownership inventory.");
  return data.map((raw) => {
    const object = raw as Partial<Record<keyof OwnedObject, unknown>>;
    if (object.bucket_id !== "memory-media" || typeof object.name !== "string" || typeof object.media_asset_id !== "string") {
      throw new Error("Invalid registered memory ownership row.");
    }
    return object as OwnedObject & { media_asset_id: string };
  });
}

export async function drainResourceCleanup(supabase: AccountDeletionStorageClient) {
  const { error: expiryError } = await supabase.rpc("expire_memory_drafts_v1", { p_limit: STORAGE_BATCH_SIZE });
  if (expiryError) throw expiryError;
  const { data, error } = await supabase.rpc("list_pending_resource_cleanup_v1", { p_limit: STORAGE_BATCH_SIZE });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Invalid resource cleanup inventory.");
  let completed = 0;
  let failed = 0;
  for (const raw of data) {
    const row = raw as { bucket_id?: unknown; storage_path?: unknown };
    if ((row.bucket_id !== "memory-media" && row.bucket_id !== "pet-avatars") || typeof row.storage_path !== "string") {
      throw new Error("Invalid resource cleanup row.");
    }
    try {
      await removeObjects(supabase, row.bucket_id, [row.storage_path]);
      const { error: ackError } = await supabase.rpc("complete_resource_cleanup_v1", {
        p_bucket_id: row.bucket_id, p_storage_path: row.storage_path,
      });
      if (ackError) throw ackError;
      completed += 1;
    } catch {
      // The durable row remains for the next authenticated worker invocation.
      failed += 1;
    }
  }
  return { completed, failed };
}

// This global queue is supplemental; its failure must not block an account's own verified cleanup.
export async function tryDrainResourceCleanup(supabase: AccountDeletionStorageClient) {
  try {
    const result = await drainResourceCleanup(supabase);
    if (result.failed > 0) console.warn("Supplemental resource cleanup deferred");
    return { ...result, drainFailed: result.failed > 0 };
  } catch {
    console.warn("Supplemental resource cleanup deferred");
    return { completed: 0, failed: 1, drainFailed: true };
  }
}
