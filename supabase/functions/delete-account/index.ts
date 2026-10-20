import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { requireUser, serviceClient, type ServiceClient } from "../_shared/supabase.ts";
import {
  beginAccountDeletion,
  claimAccountDeletionOperation,
  clearDeletingUserOwnership,
  completeAccountDeletion,
  getAccountDeletionJob,
  listPendingAccountDeletionJobs,
  markAuthDeleted,
  purgeOwnedPetMedia,
  readAccountDeletionStorageState,
  recordAccountDeletionFailure,
  releaseAccountDeletionOperation,
  removeDeletingUserOwnedObjects,
  removeUnregisteredRehomeObjects,
  rollbackAccountDeletion,
  type AccountDeletionStorageClient,
  type AccountDeletionJob,
} from "./storage.ts";

// In-app account deletion (Apple Guideline 5.1.1(v)). Registered media created
// on another owner's pet survives with an ownerless Storage copy and a nullable
// creator. Owned pets/records/media are removed. A durable database job closes
// upload races. A scheduled worker resumes interrupted cleanup independently
// of the deleted user's session, while operation leases serialize all attempts.

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = serviceClient();
  const storageClient = supabase as unknown as AccountDeletionStorageClient;
  if (request.headers.has("x-pawbloom-account-deletion-worker")) {
    return drainDeletionJobs(request, supabase, storageClient);
  }

  let claimedUserId: string | null = null;
  let authDeleted = false;
  let operationId: string | null = null;
  let preparingActiveUser = false;
  let deleteAttempted = false;
  try {
    const token = readBearerToken(request);
    claimedUserId = await readVerifiedSubject(token, supabase);
    const candidateOperationId = crypto.randomUUID();
    if (!await claimAccountDeletionOperation(storageClient, claimedUserId, candidateOperationId)) {
      return errorResponse("Account deletion is already in progress", 409);
    }
    operationId = candidateOperationId;
    let job = await getAccountDeletionJob(storageClient, claimedUserId);
    const activeUser = await resolveActiveUser(request, supabase).catch(() => null);

    if (activeUser) {
      if (activeUser.id !== claimedUserId) throw new Error("JWT subject mismatch");
      job = await beginAccountDeletion(storageClient, activeUser.id);
      preparingActiveUser = true;
      await prepareAuthDeletion(storageClient, activeUser.id, job);

      deleteAttempted = true;
      const { error: deleteError } = await supabase.auth.admin.deleteUser(activeUser.id);
      if (deleteError) {
        const { data: currentAccount, error: lookupError } = await supabase.auth.admin.getUserById(activeUser.id);
        if (currentAccount?.user) {
          await rollbackAccountDeletion(storageClient, activeUser.id);
          throw deleteError;
        }
        if (!lookupError || !isUserNotFound(lookupError)) throw deleteError;
      }
      authDeleted = true;
      await markAuthDeleted(storageClient, activeUser.id);
      job = { ...job, status: "auth_deleted" };
    } else {
      job = await authorizeCleanupResume(supabase, storageClient, claimedUserId, job);
      authDeleted = job?.status === "auth_deleted";
    }

    if (!job) throw new Error("Account deletion job was not found.");
    await finishStorageCleanup(storageClient, claimedUserId, job);

    return jsonResponse({ ok: true, status: "deleted" });
  } catch (error) {
    // Log the detail server-side; never return it (schema/constraint names leak).
    console.error("delete-account failed", error);
    if (authDeleted && claimedUserId) {
      await recordFailureSafely(storageClient, claimedUserId, error);
      return jsonResponse({ ok: true, status: "cleanup_pending" }, 202);
    }
    if (preparingActiveUser && !deleteAttempted && claimedUserId) {
      try {
        await rollbackAccountDeletion(storageClient, claimedUserId);
      } catch (rollbackError) {
        await recordFailureSafely(storageClient, claimedUserId, rollbackError);
      }
    }
    return errorResponse("Failed to delete account", 500);
  } finally {
    if (claimedUserId && operationId) {
      await releaseAccountDeletionOperation(storageClient, claimedUserId, operationId);
    }
  }
});

async function resolveActiveUser(request: Request, supabase: ServiceClient) {
  return requireUser(request, supabase);
}

async function prepareAuthDeletion(
  supabase: AccountDeletionStorageClient,
  userId: string,
  job: AccountDeletionJob,
) {
  await clearDeletingUserOwnership(supabase, userId, job.job_id);
  const state = await readAccountDeletionStorageState(supabase, userId);
  if (state.registered_user_owned_count !== 0 || state.temporary_object_count !== 0) {
    throw new Error("Storage ownership preparation is incomplete.");
  }
}

async function authorizeCleanupResume(
  supabase: ServiceClient,
  storageClient: AccountDeletionStorageClient,
  userId: string,
  job: AccountDeletionJob | null,
) {
  if (!job) throw new Error("Invalid bearer token");
  if (job.status === "auth_deleted") return job;

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (data?.user) throw new Error("An active user must authenticate account deletion.");
  if (!error || !isUserNotFound(error)) throw error ?? new Error("Unable to verify deleted user state.");

  await markAuthDeleted(storageClient, userId);
  return { ...job, status: "auth_deleted" } satisfies AccountDeletionJob;
}

async function finishStorageCleanup(
  supabase: AccountDeletionStorageClient,
  userId: string,
  job: AccountDeletionJob,
) {
  await purgeOwnedPetMedia(supabase, job.owned_pet_ids);
  await removeDeletingUserOwnedObjects(supabase, userId);
  await removeUnregisteredRehomeObjects(supabase, userId);
  const state = await readAccountDeletionStorageState(supabase, userId);
  if (state.user_owned_count !== 0
    || state.owned_pet_object_count !== 0
    || state.temporary_object_count !== 0) {
    throw new Error("Account deletion Storage cleanup is incomplete.");
  }
  await completeAccountDeletion(supabase, userId);
}

async function drainDeletionJobs(
  request: Request,
  supabase: ServiceClient,
  storageClient: AccountDeletionStorageClient,
) {
  const expectedSecret = Deno.env.get("ACCOUNT_DELETION_WORKER_SECRET") ?? "";
  const suppliedSecret = request.headers.get("x-pawbloom-account-deletion-worker") ?? "";
  if (!expectedSecret || suppliedSecret !== expectedSecret) return errorResponse("Unauthorized", 401);

  const payload = await request.json().catch(() => null) as { target_user_id?: unknown } | null;
  if (!payload || (payload.target_user_id !== undefined
    && (typeof payload.target_user_id !== "string"
      || !/^[0-9a-f-]{36}$/i.test(payload.target_user_id)))) {
    return errorResponse("Invalid worker request", 400);
  }
  // Administrative recovery and verification can target exactly one account.
  // The scheduler omits the target and drains the ordinary durable queue.
  const targetUserId = payload.target_user_id as string | undefined;
  const targetJob = targetUserId ? await getAccountDeletionJob(storageClient, targetUserId) : null;
  const jobs = targetUserId
    ? (targetJob ? [{ ...targetJob, user_id: targetUserId }] : [])
    : await listPendingAccountDeletionJobs(storageClient);
  let completed = 0;
  let failed = 0;
  let restored = 0;
  for (const pendingJob of jobs) {
    const operationId = crypto.randomUUID();
    let acquired = false;
    try {
      acquired = await claimAccountDeletionOperation(storageClient, pendingJob.user_id, operationId);
      if (!acquired) continue;
      const job = await getAccountDeletionJob(storageClient, pendingJob.user_id);
      if (!job) continue;
      if (job.status === "preparing") {
        const { data, error } = await supabase.auth.admin.getUserById(pendingJob.user_id);
        if (data?.user) {
          await rollbackAccountDeletion(storageClient, pendingJob.user_id);
          restored += 1;
          continue;
        }
        if (!error || !isUserNotFound(error)) throw error ?? new Error("Unable to verify account deletion state.");
        await markAuthDeleted(storageClient, pendingJob.user_id);
      }
      await finishStorageCleanup(storageClient, pendingJob.user_id, job);
      completed += 1;
    } catch (error) {
      failed += 1;
      await recordFailureSafely(storageClient, pendingJob.user_id, error);
    } finally {
      if (acquired) await releaseAccountDeletionOperation(storageClient, pendingJob.user_id, operationId);
    }
  }
  return jsonResponse({ ok: true, completed, restored, failed });
}

async function recordFailureSafely(
  supabase: AccountDeletionStorageClient,
  userId: string,
  error: unknown,
) {
  try {
    await recordAccountDeletionFailure(
      supabase,
      userId,
      error instanceof Error ? error.message : String(error),
    );
  } catch (recordError) {
    console.error("delete-account failure could not be recorded", recordError);
  }
}

function readBearerToken(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing bearer token");
  return token;
}

// Gateway verification is disabled so the database scheduler can reach the
// secret-protected worker route. User tokens are still verified cryptographically
// against the project's JWKS before a deleted account is allowed to resume.
async function readVerifiedSubject(token: string, supabase: ServiceClient) {
  const { data, error } = await supabase.auth.getClaims(token);
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject)) {
    throw new Error("Invalid bearer subject");
  }
  return subject;
}

function isUserNotFound(error: { status?: number; message?: string }) {
  return error.status === 404 || /user.*not found/i.test(error.message ?? "");
}
