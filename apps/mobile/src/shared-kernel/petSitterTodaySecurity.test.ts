declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const migrationDirectory = `${process.cwd()}/supabase/migrations`;
const migrationNames = readdirSync(migrationDirectory);
const diaryMigrationName = migrationNames.find((name) => name.endsWith("_enforce_one_structured_diary_per_day.sql"));
const doseMigrationName = migrationNames.find((name) => name.endsWith("_restrict_pet_sitter_records_to_today.sql"));
const relaxMigrationName = migrationNames.filter((name) => name.endsWith("_relax_record_dates_to_device_local.sql")).sort().pop();
if (!diaryMigrationName || !doseMigrationName) throw new Error("pet-sitter today-only migrations must exist");
if (!relaxMigrationName) throw new Error("the device-local date relaxation migration must exist");

// The relax migration is the current authority: it replaced the fixed
// Australia/Sydney date derivation (which rejected evening saves from UTC+
// zones) with a window covering every real UTC offset. The pet-sitter
// restriction must survive that relaxation in windowed form.
const relaxMigration = readFileSync(`${migrationDirectory}/${relaxMigrationName}`, "utf8").toLowerCase();
for (const required of [
  "create or replace function app_private.matches_local_entry_date",
  "interval '14 hours'",
  "interval '12 hours'",
  'alter policy "diary_entries care team insert"',
  'alter policy "diary_entries care team update"',
  'alter policy "medication_doses care team insert"',
  'alter policy "medication_doses care team update"',
  "app_private.matches_local_entry_date(occurred_at, entry_date)",
  "app_private.matches_local_entry_date(scheduled_at, dose_date)",
]) {
  if (!relaxMigration.includes(required)) throw new Error(`device-local date migration is missing: ${required}`);
}
if ((relaxMigration.match(/matches_local_entry_date\(pg_catalog\.now\(\)/g) ?? []).length < 4) {
  throw new Error("pet-sitter writes must stay restricted to a date that can currently be 'today' on a real device");
}
if (!relaxMigration.includes("array['pet_sitter']::public.pet_member_role[]")) {
  throw new Error("the relaxed policies must keep the pet-sitter role branch");
}
