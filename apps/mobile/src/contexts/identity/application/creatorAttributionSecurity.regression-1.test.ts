declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

const root = process.cwd();
const migration = readFileSync(
  `${root}/supabase/migrations/20260719090000_account_deletion_created_by_set_null.sql`,
  "utf8",
).toLowerCase();
const routineSource = readFileSync(
  `${root}/apps/mobile/src/contexts/routine/application/petRoutineRecords.ts`,
  "utf8",
);

for (const table of ["medication_doses", "pet_routines"]) {
  if (!migration.includes(`revoke update on public.${table} from authenticated`)) {
    throw new Error(`${table} must revoke table-level UPDATE before creator attribution becomes nullable`);
  }
  const grant = migration.match(new RegExp(`grant update \\(([^)]*)\\) on public\\.${table} to authenticated`));
  if (!grant || grant[1].includes("created_by")) {
    throw new Error(`${table} mutable-column grants must exclude created_by`);
  }
}

if (routineSource.includes(".upsert(")) {
  throw new Error("pet routine saves must not upsert immutable creator attribution on conflict");
}
for (const required of [
  ".update(updatePayload)",
  "created_by: userId",
  'inserted.error.code !== "23505"',
  "const racedUpdate = await updateExisting()",
]) {
  if (!routineSource.includes(required)) {
    throw new Error(`pet routine attribution-safe save guard is missing: ${required}`);
  }
}

console.log("creator attribution security verified");
