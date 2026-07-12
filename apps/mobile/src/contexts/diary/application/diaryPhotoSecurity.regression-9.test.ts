declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const directory = `${process.cwd()}/supabase/migrations`;
const migrationName = readdirSync(directory).find((name) => name.endsWith("_atomic_photo_diary_save.sql"));
if (!migrationName) throw new Error("the atomic photo diary migration must exist");
const migration = readFileSync(`${directory}/${migrationName}`, "utf8").toLowerCase();

for (const required of [
  "create or replace function app_private.create_photo_diary_entry",
  "security definer",
  "array['owner','caregiver']::public.pet_member_role[]",
  "array['pet_sitter']::public.pet_member_role[]",
  "'australia/sydney'",
  "p_occurred_at))::date <> p_entry_date",
  "p_media is null",
  "jsonb_array_length(p_media) < 1",
  "pg_advisory_xact_lock",
  "so.owner_id = current_actor_user_id::text",
  "insert into public.diary_entries",
  "insert into public.media_assets",
  "pet media uploader update",
  "pet media uploader delete",
  "grant execute on function public.create_photo_diary_entry",
]) {
  if (!migration.includes(required)) throw new Error(`atomic photo diary SQL is missing: ${required}`);
}
