import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDir = join(process.cwd(), "supabase/migrations");
const migrations = readdirSync(migrationDir).filter((file) => file.endsWith(".sql"));
if (!migrations.length) {
  console.error("No Supabase migrations found.");
  process.exit(1);
}

const sql = migrations.map((file) => readFileSync(join(migrationDir, file), "utf8")).join("\n").toLowerCase();
const tables = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((match) => match[1]);
const failures = [];

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

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Supabase verification passed (${tables.length} public tables checked).`);

