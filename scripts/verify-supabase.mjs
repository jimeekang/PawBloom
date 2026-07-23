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

for (const table of ["medication_doses", "pet_routines"]) {
  if (!sql.includes(`revoke update on public.${table} from authenticated`)) {
    failures.push(`Authenticated clients must not retain table-level UPDATE on public.${table}.`);
  }
  const grant = sql.match(new RegExp(`grant update \\(([^)]*)\\) on public\\.${table} to authenticated`));
  if (!grant || grant[1].includes("created_by")) {
    failures.push(`Authenticated UPDATE grants for public.${table} must exclude created_by.`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Supabase verification passed (${tables.length} public tables checked).`);
