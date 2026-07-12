declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const root = process.cwd();
const migrationDirectory = `${root}/supabase/migrations`;
const migrationName = readdirSync(migrationDirectory).find((name) => name.endsWith("_transactional_media_cleanup.sql"));
if (!migrationName) throw new Error("the transactional media cleanup migration must exist");

const migration = readFileSync(`${migrationDirectory}/${migrationName}`, "utf8").toLowerCase();
const diaryRecords = readFileSync(`${root}/apps/mobile/src/contexts/diary/application/diaryRecords.ts`, "utf8");
const authState = readFileSync(`${root}/apps/mobile/src/contexts/identity/application/authContextState.ts`, "utf8");
const cleanupRetryHook = readFileSync(`${root}/apps/mobile/src/contexts/identity/application/usePendingMediaCleanupRetry.ts`, "utf8");
const pendingCleanupFunction = migration.match(
  /create or replace function app_private\.list_pending_media_cleanup_v1\(\)[\s\S]*?\n\$\$;/,
)?.[0];
const cleanupAuthorizationFunction = migration.match(
  /create or replace function app_private\.can_cleanup_media\(target_storage_path text\)[\s\S]*?\n\$\$;/,
)?.[0];
const cleanupCompletionFunction = migration.match(
  /create or replace function app_private\.complete_media_cleanup_v1\(p_storage_paths text\[\]\)[\s\S]*?\n\$\$;/,
)?.[0];

for (const required of [
  "create table app_private.media_cleanup_jobs",
  "media_cleanup_jobs_storage_path_idx",
  "on delete cascade",
  "create or replace function app_private.prevent_queued_media_registration",
  "before insert or update of storage_path on public.media_assets",
  "pg_catalog.hashtextextended('media-cleanup:' || candidate_path, 0)",
  "create or replace function app_private.replace_pet_profile_photo_v1",
  "for key share",
  "object.created_at < now() - interval '1 hour'",
  "where registered.storage_path = object.name",
  "create or replace function app_private.delete_diary_entry_v1",
  "create or replace function app_private.delete_pet_v1",
  "array['owner']::public.pet_member_role[]",
  "create or replace function public.list_pending_media_cleanup_v1",
  "security invoker",
  "pet media queued cleanup delete",
  "drop policy if exists \"pet media owner delete\"",
  "drop policy if exists \"pet media uploader delete\"",
  "drop policy if exists \"pet media care team update\"",
  "drop policy if exists \"pet media uploader update\"",
  "pet media unregistered uploader delete",
  "pet media unregistered uploader update",
  "owner_id = (select auth.uid())::text",
  "pet media queued cleanup hidden",
  "as restrictive for select to authenticated",
  "revoke delete on table public.pets from authenticated",
  "revoke delete on table public.diary_entries from authenticated",
  "revoke insert, delete on table public.media_assets from authenticated",
]) {
  if (!migration.includes(required)) throw new Error(`media cleanup SQL is missing: ${required}`);
}
if ((migration.match(/where registered\.storage_path = name/g) ?? []).length < 3) {
  throw new Error("every direct Storage update/delete path must reject registered media objects");
}
if (!pendingCleanupFunction || !cleanupAuthorizationFunction || !cleanupCompletionFunction) {
  throw new Error("media cleanup SQL must keep discovery, authorization, and acknowledgment atomic functions");
}
for (const required of [
  "object.owner_id is not null",
  "object.owner_id = actor_user_id::text",
  "object.created_at <= now() - interval '1 hour'",
  "coalesce(object.updated_at, object.created_at) <= now() - interval '1 hour'",
  "object.name ~ (",
  "app_private.is_pet_member(pet.id, actor_user_id)",
  "where registered.storage_path = object.name",
]) {
  if (!pendingCleanupFunction.includes(required)) {
    throw new Error(`aged diary orphan discovery is missing: ${required}`);
  }
}
if (!pendingCleanupFunction.includes("join public.pets as pet")
  || !pendingCleanupFunction.includes("on object.name like pet.id::text || '/diary/%'")) {
  throw new Error("orphan discovery must bind each diary path to an authorized pet without casting untrusted paths");
}
if (!cleanupAuthorizationFunction.includes("not exists (")
  || !cleanupAuthorizationFunction.includes("from public.media_assets as registered")) {
  throw new Error("Storage deletion authorization must fail closed if an orphan becomes registered before removal");
}
if (!migration.includes("where job.storage_path = new.storage_path")
  || !migration.includes("media object is already queued for cleanup")) {
  throw new Error("media registration and cleanup queueing must serialize on the same storage path");
}
if (!cleanupCompletionFunction.includes("or exists (")
  || !cleanupCompletionFunction.includes("from public.media_assets as registered")) {
  throw new Error("a late successful diary commit must safely cancel its stale cleanup job");
}
if (!diaryRecords.includes("deleteDiaryEntryAtomic(supabase, petId, id)") || diaryRecords.includes('.from("diary_entries").delete()')) {
  throw new Error("mobile diary deletion must use the cleanup-aware atomic RPC instead of direct DELETE");
}
if (!authState.includes("usePendingMediaCleanupRetry(user?.id ?? null)")
  || !cleanupRetryHook.includes("retryPendingMediaCleanup(client)")
  || !cleanupRetryHook.includes('AppState.addEventListener("change"')
  || !cleanupRetryHook.includes("NetInfo.addEventListener")) {
  throw new Error("pending media cleanup must retry on session restore, app activation, and reconnect");
}
