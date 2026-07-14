declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const migration = readFileSync(
  `${process.cwd()}/supabase/migrations/20260714021421_append_photo_diary_media.sql`,
  "utf8",
).toLowerCase();

for (const required of [
  "create or replace function app_private.update_photo_diary_entry",
  "security definer",
  "array['owner','caregiver']::public.pet_member_role[]",
  "for update",
  "p_append_mutation_id::text || '-%'",
  "object.owner_id = actor_user_id::text",
  "daily_photo_count + new_photo_count > 5",
  "entry.entry_date = target_entry.entry_date",
  "hashtextextended(p_pet_id::text || ':' || target_entry.entry_date::text, 0)",
  "existing_entry_id <> p_entry_id",
  "grant execute on function public.update_photo_diary_entry",
]) {
  if (!migration.includes(required)) throw new Error(`photo diary append SQL is missing: ${required}`);
}

if (migration.includes("array['owner','caregiver','pet_sitter']")) {
  throw new Error("pet sitters must not append photos while editing an existing diary record");
}
