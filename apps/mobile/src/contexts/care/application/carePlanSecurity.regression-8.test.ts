declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const directory = `${process.cwd()}/supabase/migrations`;
const migrationName = readdirSync(directory).find((name) => name.endsWith("_atomic_care_setup_save.sql"));
if (!migrationName) throw new Error("the atomic care setup migration must exist");
const migration = readFileSync(`${directory}/${migrationName}`, "utf8").toLowerCase();
const careRecords = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/care/application/carePlanRecords.ts`, "utf8");
const scheduleRecords = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/medication/application/medicationScheduleRecords.ts`, "utf8");

for (const required of [
  "create table if not exists app_private.care_setup_mutations",
  "pg_advisory_xact_lock",
  "create or replace function app_private.save_care_setup_v1",
  "security definer",
  "array['owner','caregiver']::public.pet_member_role[]",
  "'plans', coalesce",
  "cp.condition_id is not distinct from selected_condition_id",
  "array['owner']::public.pet_member_role[]",
  "only the pet owner can delete a care plan.",
  "only the pet owner can remove medication schedules.",
  "delete from public.medication_schedules",
  "deferrable initially deferred",
  "revoke insert, update, delete on table public.conditions from authenticated",
  "revoke insert, update, delete on table public.medication_schedules from authenticated",
  "grant execute on function public.save_care_setup_v1(uuid, jsonb) to authenticated",
]) {
  if (!migration.includes(required)) throw new Error(`atomic care setup SQL is missing: ${required}`);
}

const scheduleDeleteGuardCount = migration.match(/only the pet owner can remove medication schedules\./g)?.length ?? 0;
if (scheduleDeleteGuardCount !== 3) {
  throw new Error("every schedule-removal branch must preserve owner-only delete semantics inside the SECURITY DEFINER RPC");
}

for (const source of [careRecords, scheduleRecords]) {
  if (/\.from\("(?:conditions|care_plans|medications|medication_schedules)"\)\.(?:insert|update|delete|upsert)/.test(source)) {
    throw new Error("care setup writes must not bypass save_care_setup_v1 after direct table grants are revoked");
  }
}
