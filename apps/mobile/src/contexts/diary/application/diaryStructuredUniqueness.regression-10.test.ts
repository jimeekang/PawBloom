declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};
const root = process.cwd();
const migrationName = readdirSync(`${root}/supabase/migrations`).find((name) => name.endsWith("_enforce_one_structured_diary_per_day.sql"));
if (!migrationName) throw new Error("the structured diary uniqueness migration must exist");
const migration = readFileSync(`${root}/supabase/migrations/${migrationName}`, "utf8").toLowerCase();

for (const required of [
  "add column superseded_by uuid",
  "foreign key (superseded_by)",
  "diary_entries_one_active_structured_category_per_day",
  "where superseded_by is null",
  "alter policy \"diary_entries member select\"",
  "alter policy \"diary_entries care team update\"",
  "revoke insert, update on table public.diary_entries from authenticated",
]) {
  if (!migration.includes(required)) throw new Error(`structured diary SQL is missing: ${required}`);
}

const backfillUpdate = migration.match(/update public\.diary_entries de\s+set[\s\S]*?from ranked/)?.[0];
if (!backfillUpdate || backfillUpdate.includes("updated_at")) {
  throw new Error("duplicate backfill must preserve historical updated_at values");
}

const authenticatedInsertGrant = migration.match(/grant insert \([\s\S]*?\) on table public\.diary_entries to authenticated/)?.[0];
const authenticatedUpdateGrant = migration.match(/grant update \([\s\S]*?\) on table public\.diary_entries to authenticated/)?.[0];
if (!authenticatedInsertGrant || !authenticatedUpdateGrant) throw new Error("diary insert and update grants must be column-scoped");
if (authenticatedInsertGrant.includes("superseded_by") || authenticatedUpdateGrant.includes("superseded_by")) {
  throw new Error("authenticated clients must not control the server-owned superseded marker");
}
// The date rules were later relaxed to the device-local window (see the
// _relax_record_dates_to_device_local migration and petSitterTodaySecurity
// test); this migration must still establish the photo boundary, and the relax
// migration must carry it forward.
if (!migration.includes("and category <> 'photo'")) {
  throw new Error("direct diary inserts must exclude photos (photos go through the atomic function)");
}
const relaxName = readdirSync(`${root}/supabase/migrations`).filter((name) => name.endsWith("_relax_record_dates_to_device_local.sql")).sort().pop();
if (!relaxName) throw new Error("the device-local date relaxation migration must exist");
const relaxSql = readFileSync(`${root}/supabase/migrations/${relaxName}`, "utf8").toLowerCase();
if (!relaxSql.includes("and category <> 'photo'") || !relaxSql.includes("matches_local_entry_date(occurred_at, entry_date)")) {
  throw new Error("the relaxed diary insert policy must keep the photo boundary and date/time consistency");
}
if (authenticatedUpdateGrant.includes("category") || authenticatedUpdateGrant.includes("entry_date")) {
  throw new Error("authenticated clients must not move diary records across categories or dates");
}
const structuredIndex = migration.match(/create unique index diary_entries_one_active_structured_category_per_day[\s\S]*?;/)?.[0];
if (!structuredIndex || structuredIndex.includes("'memo'") || structuredIndex.includes("'photo'")) {
  throw new Error("memo and photo diary categories must allow multiple entries on the same day");
}

const diaryUpdatePayload = readFileSync(`${root}/apps/mobile/src/contexts/diary/application/diaryRecordPayload.ts`, "utf8");
if (diaryUpdatePayload.includes("const payload = { category:") || diaryUpdatePayload.includes("entry_date: entryDate")) {
  throw new Error("mobile diary updates must keep the original category and date immutable");
}

const diaryRecords = readFileSync(`${root}/apps/mobile/src/contexts/diary/application/diaryRecords.ts`, "utf8");
const diaryRecordQueries = readFileSync(`${root}/apps/mobile/src/contexts/diary/application/diaryRecordQueries.ts`, "utf8");
const photoRecords = readFileSync(`${root}/apps/mobile/src/contexts/diary/application/diaryPhotoRecords.ts`, "utf8");
const offlineReplay = readFileSync(`${root}/apps/mobile/src/contexts/diary/application/diaryOfflineReplay.ts`, "utf8");
const vetReport = readFileSync(`${root}/supabase/functions/generate-vet-report/index.ts`, "utf8");
const aiBrief = readFileSync(`${root}/supabase/functions/generate-ai-brief/index.ts`, "utf8");

if ((`${diaryRecords}\n${diaryRecordQueries}`.match(/\.is\("superseded_by", null\)/g) ?? []).length < 5) {
  throw new Error("all diary list, lookup, edit, and canonical-update paths must exclude superseded rows");
}
if (!photoRecords.includes('.is("superseded_by", null)')) throw new Error("photo idempotency lookup must exclude superseded rows");
if ((offlineReplay.match(/\.is\("superseded_by", null\)/g) ?? []).length < 3) {
  throw new Error("offline replay lookups and reconciliation must target only active diary rows");
}
if (!vetReport.includes('.is("superseded_by", null)') || !aiBrief.includes('.is("superseded_by", null)')) {
  throw new Error("generated report and AI brief source queries must exclude superseded diary rows");
}
if (!diaryRecords.includes('action === "update-canonical"') || !offlineReplay.includes('action === "keep-canonical"')) {
  throw new Error("direct and offline structured conflicts must use the shared canonical reconciliation policy");
}
