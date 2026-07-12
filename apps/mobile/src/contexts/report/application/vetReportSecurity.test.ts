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

const migration = readFileSync(`${migrationDirectory}/${migrationName}`, "utf8").toLowerCase();
const records = readFileSync(`${root}/apps/mobile/src/contexts/report/application/vetReportRecords.ts`, "utf8");
const generator = readFileSync(`${root}/supabase/functions/generate-vet-report/index.ts`, "utf8");

if (!migration.includes("revoke insert, update on table public.vet_reports from authenticated")) {
  throw new Error("Authenticated clients must not author or mutate server-generated report artifacts directly");
}
if (!migration.includes("array['owner']::public.pet_member_role[]") || !migration.includes("only the pet owner can confirm")) {
  throw new Error("Report confirmation must enforce owner-only authorization inside the database transition");
}
if (!migration.includes("create or replace function app_private.confirm_vet_report") || !migration.includes("security definer")) {
  throw new Error("The privileged confirmation transition must stay in the non-exposed app_private schema");
}
if (!migration.includes("create or replace function public.confirm_vet_report") || !migration.includes("security invoker")) {
  throw new Error("The exposed report RPC must remain an explicitly granted security-invoker wrapper");
}
if (!records.includes('.rpc("confirm_vet_report"') || !records.includes('.rpc("mark_vet_report_shared"') || records.includes('.from("vet_reports")')) {
  throw new Error("Mobile report transitions must use the guarded RPCs instead of direct table writes");
}
if (!generator.includes("if (petResult.error)") || !generator.includes("if (entriesResult.error)") || !generator.includes("if (dosesResult.error)")) {
  throw new Error("Report generation must reject every failed source query instead of emitting an empty artifact");
}
