import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDir = join(process.cwd(), "supabase/migrations");
const migrations = readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();
if (!migrations.length) {
  console.error("No Supabase migrations found.");
  process.exit(1);
}

const migrationSources = migrations.map((file) => ({
  file,
  sql: readFileSync(join(migrationDir, file), "utf8").toLowerCase(),
}));
const sql = migrationSources.map((migration) => migration.sql).join("\n");
const generatedTypes = readFileSync(
  join(process.cwd(), "apps/mobile/generated-supabase/database.types.ts"),
  "utf8",
);
const tables = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((match) => match[1]);
const failures = [];

function generatedTableBlock(table) {
  const header = `      ${table}: {`;
  const start = generatedTypes.indexOf(header);
  if (start < 0) return "";
  const remaining = generatedTypes.slice(start + header.length);
  const nextTable = remaining.search(/\n      [a-z_]+: \{\n        Row:/);
  const tablesEnd = remaining.indexOf("\n    }\n    Views:");
  const endOffsets = [nextTable, tablesEnd].filter((offset) => offset >= 0);
  const end = endOffsets.length > 0 ? Math.min(...endOffsets) : remaining.length;
  return generatedTypes.slice(start, start + header.length + end);
}

for (const table of tables) {
  if (!sql.includes(`alter table public.${table} enable row level security`)) {
    failures.push(`Missing RLS enable statement for public.${table}`);
  }
  if (!sql.includes(`on public.${table}`)) {
    failures.push(`Missing policy coverage for public.${table}`);
  }
  if (!sql.includes(`on public.${table} to authenticated`)) {
    failures.push(`Missing explicit authenticated GRANT for public.${table}`);
  }
}

if (!sql.includes("insert into storage.buckets") || !sql.includes("pet-media")) {
  failures.push("Missing private pet-media storage bucket setup.");
}

if (sql.includes("auth.role()")) {
  failures.push("Migration must not use deprecated auth.role().");
}

if (!sql.includes("grant execute on function app_private.is_pet_member")) {
  failures.push("Membership helper function must have explicit execute grant.");
}

const petOwnerReturningMigration = migrationSources.find((migration) =>
  migration.file.endsWith("_allow_pet_owner_insert_returning.sql"),
);
const petOwnerReturningPolicy = petOwnerReturningMigration?.sql
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();
if (petOwnerReturningPolicy !== 'alter policy "pets members select" on public.pets using ( owner_id = (select auth.uid()) or app_private.is_pet_member(id, (select auth.uid())) );') {
  failures.push("Pet INSERT RETURNING fix must only extend SELECT to the canonical owner while preserving active membership access.");
}

const profileIdentityMigration = migrationSources.find((migration) =>
  migration.sql.includes("profiles_email_lower_unique_idx"),
);
if (!profileIdentityMigration) {
  failures.push("Missing case-insensitive profile email uniqueness guard.");
} else {
  const canonicalBackfill = profileIdentityMigration.sql.indexOf("insert into public.profiles (id, email)");
  const uniqueIndex = profileIdentityMigration.sql.indexOf("profiles_email_lower_unique_idx");
  if (canonicalBackfill < 0 || uniqueIndex < canonicalBackfill) {
    failures.push("Profile email uniqueness must be created after the canonical auth.users backfill.");
  }
}

const nullableCreatorTables = [...new Set([...sql.matchAll(
  /alter table public\.([a-z_]+) alter column created_by drop not null/g,
)].map((match) => match[1]))];
for (const table of nullableCreatorTables) {
  const creatorFk = [
    `alter table public.${table} add constraint ${table}_created_by_fkey`,
    "foreign key (created_by) references auth.users(id) on delete set null",
  ];
  const tableMigration = migrationSources.find((migration) =>
    creatorFk.every((fragment) => migration.sql.includes(fragment)),
  );
  if (!tableMigration) {
    failures.push(`Missing ON DELETE SET NULL creator FK coverage for public.${table}`);
  }
  if (!sql.includes(`create index if not exists ${table}_created_by_idx on public.${table} (created_by)`)) {
    failures.push(`Missing creator FK index for public.${table}`);
  }

  const typeBlock = generatedTableBlock(table);
  const requiredCreator = "          created_by: string | null";
  const optionalCreator = "          created_by?: string | null";
  const requiredCount = typeBlock.split(requiredCreator).length - 1;
  const optionalCount = typeBlock.split(optionalCreator).length - 1;
  if (!typeBlock || requiredCount !== 1 || optionalCount !== 2) {
    failures.push(`Generated types must make public.${table}.created_by nullable.`);
  }
}

const accountDeletionStorageMigration = migrationSources.find((migration) =>
  migration.file.endsWith("_harden_account_deletion_storage.sql"),
);
const accountDeletionWorkerMigration = migrationSources.find((migration) =>
  migration.file.endsWith("_account_deletion_durable_worker.sql"),
);
if (!accountDeletionStorageMigration || !accountDeletionWorkerMigration) {
  failures.push("Missing account deletion Storage hardening migration.");
} else {
  const deletionSql = `${accountDeletionStorageMigration.sql}\n${accountDeletionWorkerMigration.sql}`;
  for (const invariant of [
    "create table app_private.account_deletion_jobs",
    "create table app_private.account_deletion_media_rehomes",
    "create table app_private.account_deletion_leases",
    "lock table storage.objects in share mode",
    "lock table public.media_assets in share mode",
    'create policy "pet media account deletion insert guard"',
    'create policy "pet media account deletion update guard"',
    "destination.owner_id is null",
    "grant execute on function public.rehome_account_deletion_media_v1(uuid, uuid, text, text) to service_role",
    "create or replace function app_private.request_account_deletion_cleanup_v1()",
    "cron.schedule(",
  ]) {
    if (!deletionSql.includes(invariant)) {
      failures.push(`Missing account deletion Storage invariant: ${invariant}`);
    }
  }
  if (/\b(insert into|update|delete from)\s+storage\.objects\b/.test(deletionSql)) {
    failures.push("Account deletion must mutate managed Storage objects through the Storage API only.");
  }
}

for (const table of ["medication_doses", "pet_routines"]) {
  if (!sql.includes(`revoke update on public.${table} from authenticated`)) {
    failures.push(`Authenticated clients must not retain table-level UPDATE on public.${table}.`);
  }
  const grant = sql.match(new RegExp(`grant update \\(([^)]*)\\) on public\\.${table} to authenticated`));
  if (!grant || grant[1].includes("created_by")) {
    failures.push(`Authenticated UPDATE grants for public.${table} must exclude created_by.`);
  }
}

const auditWriteHardeningIndex = migrationSources.findIndex((migration) =>
  migration.sql.includes("revoke insert on table public.audit_events from anon, authenticated")
  && migration.sql.includes('drop policy if exists "audit own insert" on public.audit_events'),
);
if (auditWriteHardeningIndex < 0) {
  failures.push("Authenticated clients must not retain a direct audit_events INSERT path.");
} else {
  const laterAuditStatements = migrationSources
    .slice(auditWriteHardeningIndex + 1)
    .flatMap((migration) => migration.sql.split(";").map((statement) => ({
      file: migration.file,
      statement: statement.replace(/\s+/g, " ").trim(),
    })))
    .filter(({ statement }) => statement.includes("public.audit_events"));

  for (const { file, statement } of laterAuditStatements) {
    const grantsClientInsert = /^grant\b/.test(statement)
      && /\b(?:insert|all)(?:\s*\([^)]*\))?\b/.test(statement)
      && /\bto\b[^;]*\b(?:anon|authenticated)\b/.test(statement);
    const createsWritePolicy = /^create policy\b/.test(statement)
      && (!/\bfor\s+(?:select|insert|update|delete|all)\b/.test(statement)
        || /\bfor\s+(?:insert|all)\b/.test(statement));
    const revokesAuthenticatedRead = /^revoke\b/.test(statement)
      && /\b(?:select|all)\b/.test(statement)
      && /\bfrom\b[^;]*\bauthenticated\b/.test(statement);
    const revokesServiceAccess = /^revoke\b/.test(statement)
      && /\b(?:select|insert|all)\b/.test(statement)
      && /\bfrom\b[^;]*\bservice_role\b/.test(statement);
    const dropsReadPolicy = /^drop policy\b/.test(statement)
      && /["']audit own pet select["']/.test(statement);

    if (grantsClientInsert || createsWritePolicy || revokesAuthenticatedRead
      || revokesServiceAccess || dropsReadPolicy) {
      failures.push(`Later migration ${file} contradicts the final audit_events ACL.`);
    }
  }
}

const memoryMigration = migrationSources.find((migration) =>
  migration.file.endsWith("_avatar_memories_atomic_contract.sql"),
);
if (!memoryMigration) {
  failures.push("Missing atomic avatar/memory migration.");
} else {
  const contract = memoryMigration.sql.replace(/\s+/g, " ");
  for (const table of ["memories", "memory_pets", "memory_media", "pet_avatar_jobs", "pet_avatars"]) {
    if (!generatedTableBlock(table)) failures.push(`Missing generated type for public.${table}.`);
    if (!new RegExp(`create policy [^;]+ on public\\.${table} for select to authenticated`).test(contract)) {
      failures.push(`Missing authenticated SELECT policy for public.${table}.`);
    }
  }
  for (const bucket of ["pet-avatars", "memory-media"]) {
    if (!contract.includes(`'${bucket}'`)
      || !contract.includes("insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) select bucket,bucket,false,l.max_file_bytes,l.mime_types")
      || !contract.includes("create or replace function app_private.resource_storage_insert")) {
      failures.push(`Missing private, budgeted, relational Storage contract for ${bucket}.`);
    }
  }
  for (const fragment of [
    "create or replace function app_private.lock_pet_resource_writes()",
    "select pg_catalog.pg_advisory_xact_lock_shared(1346459468,1295070001)",
    "revoke all on function app_private.lock_pet_resource_writes() from public,anon,authenticated",
    "create trigger serialize_pet_resource_writes before delete on auth.users",
    "create index memory_pets_pet_memory_idx on public.memory_pets(pet_id,memory_id)",
    "create unique index pet_avatars_one_applied_idx",
    "revoke all on public.memories,public.memory_pets,public.memory_media,public.pet_avatar_jobs,public.pet_avatars from anon,authenticated",
    "create table app_private.resource_cleanup_jobs",
    "create constraint trigger resource_storage_completion after insert or update on storage.objects deferrable initially deferred",
    "create or replace function app_private.guard_resource_storage_completion()",
    "create or replace function public.prepare_account_deletion_memory_rehome_v2",
    "where id=target for update nowait",
    "where id=target for share nowait",
    "order by pet_id,id loop",
    "app_private.lock_pet_members_for_delete(old.id)",
    "create table app_private.memory_mutation_receipts",
    "app_private.daily_photo_count(p_pet_id,target_entry.entry_date)",
  ]) {
    if (!contract.includes(fragment)) failures.push(`Missing avatar/memory invariant: ${fragment}`);
  }
  for (const table of ["public.pets", "public.pet_members", "public.memories", "public.memory_pets", "public.memory_media", "public.pet_avatar_jobs", "public.pet_avatars", "public.diary_entries", "public.media_assets", "app_private.account_deletion_jobs", "app_private.account_deletion_media_rehomes", "app_private.media_cleanup_jobs", "app_private.resource_cleanup_jobs"]) {
    if (!contract.includes(`create trigger serialize_pet_resource_writes before insert or update or delete on ${table} for each statement execute function app_private.serialize_pet_resource_statement()`)) failures.push(`Missing pre-row resource gate: ${table}`);
  }
  const acquisition = contract.match(/create or replace function app_private\.lock_memory_pets\([^$]+\$\$[\s\S]*?\$\$;/)?.[0] || "";
  const deletionLocks = contract.match(/create or replace function app_private\.lock_pet_members_for_delete\([^$]+\$\$[\s\S]*?\$\$;/)?.[0] || "";
  for (const body of [acquisition, deletionLocks]) {
    if (!/exception when lock_not_available then/.test(body) || !/raise exception 'release_pet_resource_lock_probe' using errcode='pz001'/.test(body)
      || !/exception when sqlstate 'pz001' then null/.test(body)) failures.push("Pet/member lock sets must roll back a failed NOWAIT attempt and its single blocking probe.");
    if (/deadlock_detected|40p01|pg_sleep|when others|query_canceled/.test(body)) failures.push("Resource acquisition must not swallow deadlocks, timeouts, cancellation, or busy-poll.");
  }
  const routineGate = contract.match(/create or replace function app_private\.lock_pet_resource_writes\(\)[^$]+\$\$[\s\S]*?\$\$;/)?.[0] || "";
  if (!routineGate.includes("pg_advisory_xact_lock_shared") || /pg_advisory_xact_lock\(/.test(routineGate)) failures.push("Routine writes must never take the global exclusive structure lock.");
  if (!contract.includes("create trigger serialize_pet_resource_writes before delete on auth.users for each statement execute function app_private.serialize_pet_resource_structure()")) failures.push("Auth deletion must enter the structure barrier before tuples.");
  for (const name of ["begin_account_deletion_v1", "cancel_account_deletion_v1"]) {
    const body = contract.match(new RegExp(`create or replace function public\\.${name}\\([^$]+\\$\\$[\\s\\S]*?\\$\\$;`))?.[0] || "";
    if (!/begin perform app_private\.lock_pet_resource_structure\(\);/.test(body)) failures.push(`Account ${name} must enter the exclusive structure barrier first.`);
  }
  const exclusiveCalls = [...contract.matchAll(/perform app_private\.lock_pet_resource_structure\(\);/g)];
  if (exclusiveCalls.length !== 3) failures.push("Exclusive structure barrier is restricted to its trigger and account begin/cancel.");
  if (/create trigger lock_pet_members_(?:insert|update|delete)|function app_private\.lock_changed_pet_memberships/.test(contract)) failures.push("Membership DML must not reacquire pets after member tuples.");
  for (const spec of ["pet_id,user_id on public.pet_members", "id,owner_id on public.pets", "pet_id,diary_entry_id on public.media_assets", "pet_id,id on public.pet_avatar_jobs", "pet_id,job_id,id on public.pet_avatars"]) {
    if (!contract.includes(`create trigger a_resource_structure before update of ${spec} for each statement execute function app_private.serialize_pet_resource_structure()`)) failures.push(`Missing pre-row identity structure barrier: ${spec}`);
  }
  if ([...contract.matchAll(/create trigger [^;]+execute function app_private\.serialize_pet_resource_structure\(\)/g)].length !== 6) failures.push("Exclusive statement triggers are restricted to Auth deletion and five identity relocations.");
  if (/create trigger serialize_pet_resource_writes [^;]+ on storage.objects/.test(contract)) failures.push("Storage DELETE must not acquire the app gate after prelocking an object.");
  const preflight = contract.match(/create or replace function app_private\.resource_storage_insert\([^;]+(?:;[^$]*)*?\$\$;/)?.[0] || "";
  if (!preflight || /lock_pet_resource_writes|lock_memory|for update|for no key update|for share|for key share/.test(preflight)) failures.push("Storage preflight must remain read-only without row/advisory locks.");
  const completion = contract.match(/create or replace function app_private\.guard_resource_storage_completion\(\)[^$]+\$\$[\s\S]*?\$\$;/)?.[0] || "";
  if (!/begin perform app_private\.lock_pet_resource_writes\(\); if new\.bucket_id/.test(completion)) failures.push("Actual Storage completion must acquire the gate before fresh authorization checks.");
  if (/lock table [^;]+ in share mode/.test(contract)) failures.push("Resource gate must not be followed by conflicting SHARE table locks.");
  if (/grant (?:all|select) on public\.pet_avatar_jobs to authenticated/.test(contract)) {
    failures.push("Avatar provider fields must not have a table-level authenticated SELECT grant.");
  }
  if (/create policy [^;]+ on public\.(?:memory_pets|memory_media) for (?:insert|update|delete|all) to authenticated/.test(contract)) {
    failures.push("Memory junction/media direct client DML must remain closed.");
  }
}

// Edge imports must stay reproducible; a bare tag/range can silently change SDK behavior.
function pinnedEdgeSpecifier(specifier) {
  const packageName = specifier.replace(/^(?:npm:|https:\/\/esm\.sh\/)/, "");
  return /^(?:@[^/@]+\/)?[^/@]+@(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:\/[^?#]*)?(?:\?[^#]*)?$/.test(packageName);
}
for (const [specifier, expected] of [
  ["npm:openai@7.38.0", true], ["npm:zod@4.6.7", true], ["npm:openai@7", false],
  ["https://esm.sh/@supabase/supabase-js@2.108.2", true], ["npm:zod", false],
  ["npm:zod@^4.6.7", false], ["npm:zod@latest", false], ["npm:zod@4", false], ["npm:zod@4.6", false],
  ["npm:zod@4.6.7-beta", false], ["https://esm.sh/@supabase/supabase-js", false],
]) {
  if (pinnedEdgeSpecifier(specifier) !== expected) throw new Error("Edge import pin check fixture failed.");
}
function edgeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? edgeFiles(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}
for (const file of edgeFiles(join(process.cwd(), "supabase/functions"))) {
  for (const match of readFileSync(file, "utf8").matchAll(/["'`]((?:npm:|https:\/\/esm\.sh\/)[^"'`\s]+)["'`]/g)) {
    if (!pinnedEdgeSpecifier(match[1])) failures.push(`Edge import needs an exact @x.y.z version: ${file}: ${match[1]}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Supabase verification passed (${tables.length} public tables checked).`);
