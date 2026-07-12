declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const migrationDirectory = `${process.cwd()}/supabase/migrations`;
const diaryMigrationName = readdirSync(migrationDirectory).find((name) => name.endsWith("_enforce_one_structured_diary_per_day.sql"));
const doseMigrationName = readdirSync(migrationDirectory).find((name) => name.endsWith("_restrict_pet_sitter_records_to_today.sql"));
if (!diaryMigrationName || !doseMigrationName) throw new Error("pet-sitter today-only migrations must exist");

const diaryMigration = readFileSync(`${migrationDirectory}/${diaryMigrationName}`, "utf8").toLowerCase();
const doseMigration = readFileSync(`${migrationDirectory}/${doseMigrationName}`, "utf8").toLowerCase();
for (const source of [diaryMigration, doseMigration]) {
  if (!source.includes("array['pet_sitter']::public.pet_member_role[]")
    || !source.includes("timezone('australia/sydney', pg_catalog.now()))::date")) {
    throw new Error("pet-sitter writes must be restricted to the Sydney-local current day");
  }
}
if (!diaryMigration.includes("category <> 'photo'") || !diaryMigration.includes("occurred_at))::date = entry_date")) {
  throw new Error("direct diary writes must preserve the atomic photo boundary and date/time consistency");
}
if (!doseMigration.includes("scheduled_at))::date = dose_date")
  || !doseMigration.includes('alter policy "medication_doses care team update"')) {
  throw new Error("medication insert and update policies must preserve dose date/time consistency");
}
