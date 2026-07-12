declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
};

const root = process.cwd();
const migrationDirectory = `${root}/supabase/migrations`;
const migrationName = readdirSync(migrationDirectory)
  .find((file) => file.endsWith("_secure_vet_report_transitions.sql"));
if (!migrationName) throw new Error("The secure vet report transition migration must be present");
const atomicGenerationMigrationName = readdirSync(migrationDirectory)
  .find((file) => file.endsWith("_atomic_vet_report_generation.sql"));
if (!atomicGenerationMigrationName) throw new Error("The atomic vet report generation migration must be present");
const shareLifecycleMigrationName = readdirSync(migrationDirectory)
  .find((file) => file.endsWith("_secure_vet_report_share_lifecycle.sql"));
if (!shareLifecycleMigrationName) throw new Error("The secure report share lifecycle migration must be present");

const migration = readFileSync(`${migrationDirectory}/${migrationName}`, "utf8").toLowerCase();
const atomicGenerationMigration = readFileSync(`${migrationDirectory}/${atomicGenerationMigrationName}`, "utf8").toLowerCase();
const shareLifecycleMigration = readFileSync(`${migrationDirectory}/${shareLifecycleMigrationName}`, "utf8").toLowerCase();
const records = readFileSync(`${root}/apps/mobile/src/contexts/report/application/vetReportRecords.ts`, "utf8");
const workflow = readFileSync(`${root}/apps/mobile/src/contexts/report/ui/useVetReportWorkflow.ts`, "utf8");
const generator = readFileSync(`${root}/supabase/functions/generate-vet-report/index.ts`, "utf8");
const getter = readFileSync(`${root}/supabase/functions/get-vet-report/index.ts`, "utf8");
const stateGetter = readFileSync(`${root}/supabase/functions/get-vet-report-state/index.ts`, "utf8");
const supabaseConfig = readFileSync(`${root}/supabase/config.toml`, "utf8");
const generatedDatabaseTypes = readFileSync(`${root}/apps/mobile/generated-supabase/database.types.ts`, "utf8");

if (!migration.includes("revoke insert, update on table public.vet_reports from authenticated")) {
  throw new Error("Authenticated clients must not author or mutate server-generated report artifacts directly");
}
if (!migration.includes("array['owner']::public.pet_member_role[]") || !migration.includes("only the pet owner can confirm")) {
  throw new Error("Report confirmation must enforce owner-only authorization inside the database transition");
}
if (!migration.includes("report_status not in ('confirmed', 'shared')")) {
  throw new Error("Owner confirmation retries must remain idempotent after a concurrent share transition");
}
if (!migration.includes("create or replace function app_private.confirm_vet_report") || !migration.includes("security definer")) {
  throw new Error("The privileged confirmation transition must stay in the non-exposed app_private schema");
}
if (!migration.includes("create or replace function public.confirm_vet_report") || !migration.includes("security invoker")) {
  throw new Error("The exposed report RPC must remain an explicitly granted security-invoker wrapper");
}
if (migration.includes("create or replace function public.mark_vet_report_shared") || migration.includes("create or replace function app_private.mark_vet_report_shared")) {
  throw new Error("Authenticated clients must not mark reports shared without atomically issuing a protected token");
}
if (!records.includes('.rpc("confirm_vet_report"') || !workflow.includes("issueShareToken: true") || records.includes('.from("vet_reports")')) {
  throw new Error("Mobile report transitions must use the guarded RPCs instead of direct table writes");
}
if (!generator.includes("if (petResult.error)") || !generator.includes("if (entriesResult.error)") || !generator.includes("if (dosesResult.error)")) {
  throw new Error("Report generation must reject every failed source query instead of emitting an empty artifact");
}
if (!generator.includes('.lte("occurred_at", until)') || !generator.includes('.lte("scheduled_at", until)')) {
  throw new Error("Report generation must exclude future-dated diary and medication records from historical windows");
}
if (!generator.includes("buildNormalizedVetReportPayload(pet, entriesResult.data, dosesResult.data)")) {
  throw new Error("Report generation must normalize structured diary and medication JSON before persisting the immutable artifact");
}
if (!atomicGenerationMigration.includes("create or replace function public.create_vet_report_draft_v1")
  || !atomicGenerationMigration.includes("to service_role")
  || !generator.includes('.rpc("create_vet_report_draft_v1"')
  || generator.includes('.from("vet_reports")')
  || generator.includes("shareToken")
  || atomicGenerationMigration.includes("report_share_tokens")) {
  throw new Error("Draft generation must use the service-only RPC and must not create a pre-confirmation share token");
}
if (!shareLifecycleMigration.includes("revoked_at timestamptz")
  || !shareLifecycleMigration.includes("issue_vet_report_share_v1")
  || !shareLifecycleMigration.includes("to service_role")
  || !shareLifecycleMigration.includes("only the pet owner can issue a report link")
  || !shareLifecycleMigration.includes("revoke_vet_report_share_v1")
  || !shareLifecycleMigration.includes("only the pet owner can revoke a report link")
  || !shareLifecycleMigration.includes("array['owner']::public.pet_member_role[]")
  || !stateGetter.includes('.rpc("issue_vet_report_share_v1"')
  || !stateGetter.includes('.rpc("revoke_vet_report_share_v1"')
  || !workflow.includes("revokeShareToken: true")
  || stateGetter.includes('.from("report_share_tokens").insert')) {
  throw new Error("Post-confirmation share-token rotation must be atomic, revocable, and service-only");
}
if (!stateGetter.includes('"Cache-Control": "no-store') || !getter.includes('"Cache-Control": "no-store')) {
  throw new Error("Authenticated report state and public bearer-token responses must never be cached");
}
if (!supabaseConfig.includes("[functions.get-vet-report-state]\nverify_jwt = true") || !supabaseConfig.includes("[functions.get-vet-report]\nverify_jwt = false")) {
  throw new Error("Authenticated report lifecycle and public bearer-token viewer JWT settings must remain explicit");
}
for (const requiredType of ["revoked_at: string | null", "create_vet_report_draft_v1", "issue_vet_report_share_v1", "revoke_vet_report_share_v1"]) {
  if (!generatedDatabaseTypes.includes(requiredType)) throw new Error(`generated database types are missing report lifecycle shape: ${requiredType}`);
}
if (generatedDatabaseTypes.includes("mark_vet_report_shared")) {
  throw new Error("generated database types must not advertise the removed non-atomic share transition");
}
if (!getter.includes('.is("revoked_at", null)') || !getter.includes("vetReportTextResponse(responseBody)") || !getter.includes('responseFormat === "json"') || !records.includes("&format=json")) {
  throw new Error("Public report links must render platform-supported text by default while authenticated app verification explicitly requests JSON");
}
if (!getter.includes("sanitizeStoredVetReportPayload(report.payload)")) {
  throw new Error("Public report JSON must whitelist normalized display fields instead of returning stored JSON verbatim");
}
