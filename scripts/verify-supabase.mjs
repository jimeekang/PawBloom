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

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Supabase verification passed (${tables.length} public tables checked).`);
