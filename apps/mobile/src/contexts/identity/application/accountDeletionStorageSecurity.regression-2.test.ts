declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};

const root = process.cwd();
const migrationDirectory = `${root}/supabase/migrations`;
const hardeningMigrationName = readdirSync(migrationDirectory)
  .find((name) => name.endsWith("_harden_account_deletion_storage.sql"));
if (!hardeningMigrationName) throw new Error("account deletion Storage hardening migration is required");

const forwardMigrationName = readdirSync(migrationDirectory)
  .find((name) => name.endsWith("_account_deletion_durable_worker.sql"));
if (!forwardMigrationName) throw new Error("account deletion durable worker follow-up is required");
const migration = [hardeningMigrationName, forwardMigrationName]
  .map((name) => readFileSync(`${migrationDirectory}/${name}`, "utf8")).join("\n").toLowerCase();
const index = readFileSync(`${root}/supabase/functions/delete-account/index.ts`, "utf8");
const storage = readFileSync(`${root}/supabase/functions/delete-account/storage.ts`, "utf8");
const config = readFileSync(`${root}/supabase/config.toml`, "utf8");

for (const marker of [
  "create table app_private.account_deletion_jobs",
  "create table app_private.account_deletion_media_rehomes",
  "create table app_private.account_deletion_leases",
  "lock table storage.objects in share mode",
  "lock table public.media_assets in share mode",
  'create policy "pet media account deletion insert guard"',
  'create policy "pet media account deletion update guard"',
  "on storage.objects as restrictive",
  "account deletion is already in progress",
  "destination.owner_id is null",
  "grant execute on function public.begin_account_deletion_v1(uuid) to service_role",
  "grant execute on function public.rehome_account_deletion_media_v1(uuid, uuid, text, text) to service_role",
  "create or replace function app_private.request_account_deletion_cleanup_v1()",
  "cron.schedule(",
]) {
  if (!migration.includes(marker)) throw new Error(`missing account deletion Storage invariant: ${marker}`);
}

if (/\b(insert into|update|delete from)\s+storage\.objects\b/.test(migration)) {
  throw new Error("managed Storage objects must only be mutated through the Storage API");
}

for (const marker of [
  "clearDeletingUserOwnership",
  "readAccountDeletionStorageState",
  "supabase.auth.admin.deleteUser",
  "purgeOwnedPetMedia",
  "removeDeletingUserOwnedObjects",
  "rollbackAccountDeletion",
  "drainDeletionJobs",
  "claimAccountDeletionOperation",
  "releaseAccountDeletionOperation",
  'status: "cleanup_pending"',
  "completeAccountDeletion",
]) {
  if (!index.includes(marker)) throw new Error(`delete-account must enforce ${marker}`);
}

const prepare = index.indexOf("await prepareAuthDeletion");
const hardDelete = index.indexOf("await supabase.auth.admin.deleteUser");
const finish = index.indexOf("await finishStorageCleanup");
if (prepare < 0 || hardDelete < 0 || finish < 0
  || prepare > hardDelete || hardDelete > finish
  || !index.includes("await clearDeletingUserOwnership")
  || !index.includes("await purgeOwnedPetMedia")) {
  throw new Error("registered media must be preserved/ownerless before Auth deletion, while owned-pet purge happens only after Auth succeeds");
}

for (const marker of [
  ".copy(object.name, destination)",
  'rpc("rehome_account_deletion_media_v1"',
  "crypto.randomUUID()",
  "Keep the original bytes until Auth deletion succeeds",
  "media_asset_id: object.media_asset_id",
]) {
  if (!storage.includes(marker)) throw new Error(`registered media re-home flow is incomplete: ${marker}`);
}
if (storage.includes("await removeObjects(supabase, object.bucket_id, [destination])")
  || storage.includes("await removeObjects(supabase, object.bucket_id, [object.name])")) {
  throw new Error("parallel pre-Auth re-home attempts must not delete deterministic destinations or original bytes");
}

if (!config.includes("[functions.delete-account]") || !config.includes("verify_jwt = false")
  || !index.includes("supabase.auth.getClaims(token)")) {
  throw new Error("delete-account must verify user JWT claims in-function while allowing its secret worker route");
}

console.log("account deletion Storage security boundary verified");
