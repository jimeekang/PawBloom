#!/usr/bin/env node
// Seed the App Review demo account (App Store Guideline 2.1).
//
// PawBloom is fully auth-gated behind email confirmation, so App Review needs a
// pre-confirmed account whose Today / Diary / Care / Reports tabs all show data.
// This script provisions that account reproducibly and idempotently.
//
// Environment (never hardcode, never commit real values):
//   SUPABASE_URL                 Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    Service-role key (admin: create/delete user + seed rows)
//   SUPABASE_PUBLISHABLE_KEY     Publishable/anon key, used to sign IN as the demo
//                                user so the profile photo upload + vet-report edge
//                                function run through the real authenticated path.
//                                (SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
//                                 are accepted as aliases.)
//   DEMO_ACCOUNT_EMAIL           Demo login email
//   DEMO_ACCOUNT_PASSWORD        Demo login password
//
// Flags:
//   --skip-photo   Seed everything except the pet profile photo (useful when the
//                  Storage upload path is unavailable). Everything else still runs.
//   --help         Print usage.
//
// Verification note: this script is intentionally NOT run against a live project
// in CI or here. A live run (deploying edge functions first) is deferred to the
// launch tasks. Local checks: `node --check scripts/seed-demo-account.mjs` and a
// missing-env dry run that prints the fail-fast message.
//
// @supabase/supabase-js is not installed at the repo root; it lives in
// apps/mobile/node_modules. We resolve it from there via createRequire so the
// script runs with a plain `node scripts/seed-demo-account.mjs` from the root.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const STORAGE_BUCKET = "pet-media";
const STORAGE_PAGE_SIZE = 100;
const PET_PHOTO_PATH = join(repoRoot, "apps/mobile/assets/mochi-hero.png");
const REPORT_RANGE_DAYS = 7;

function loadCreateClient() {
  try {
    const require = createRequire(join(repoRoot, "apps/mobile/package.json"));
    return require("@supabase/supabase-js").createClient;
  } catch (error) {
    fail(
      "Could not load @supabase/supabase-js from apps/mobile/node_modules.\n" +
        "Install mobile deps first: `npm --prefix apps/mobile install`.\n" +
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function fail(message) {
  console.error(`\n[seed-demo-account] ${message}\n`);
  process.exit(1);
}

function log(message) {
  console.log(`[seed-demo-account] ${message}`);
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(
      "Usage: node scripts/seed-demo-account.mjs [--skip-photo]\n" +
        "Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY,\n" +
        "DEMO_ACCOUNT_EMAIL and DEMO_ACCOUNT_PASSWORD in the environment.",
    );
    process.exit(0);
  }
  return { skipPhoto: args.has("--skip-photo") };
}

function readEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.DEMO_ACCOUNT_EMAIL;
  const password = process.env.DEMO_ACCOUNT_PASSWORD;

  const missing = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!publishableKey) missing.push("SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)");
  if (!email) missing.push("DEMO_ACCOUNT_EMAIL");
  if (!password) missing.push("DEMO_ACCOUNT_PASSWORD");
  if (missing.length) {
    fail(`Missing required environment variable(s):\n  - ${missing.join("\n  - ")}`);
  }

  return { supabaseUrl, serviceRoleKey, publishableKey, email, password };
}

// --- time helpers (Australia/Sydney is the app's canonical care timezone) -----

const anchorNow = new Date();

// Sydney calendar date (YYYY-MM-DD) for a given instant.
function sydneyDate(instant) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

// Sydney UTC offset (minutes) at a given instant, DST-aware.
function sydneyOffsetMinutes(instant) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Sydney",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - instant.getTime()) / 60000;
}

// The instant whose Sydney wall-clock time is `dateStr` at hh:mm, DST-aware.
function sydneyInstant(dateStr, hh, mm) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const guessUtc = Date.UTC(year, month - 1, day, hh, mm, 0);
  const offset = sydneyOffsetMinutes(new Date(guessUtc));
  return new Date(guessUtc - offset * 60000);
}

// Sydney calendar date `n` days before the anchor.
function sydneyDateDaysAgo(n) {
  return sydneyDate(new Date(anchorNow.getTime() - n * 86400000));
}

// --- domain payload encoders (mirror the app so both the Diary/Care tabs and
//     the vet-report edge function decode the seeded rows the same way) --------

function encodeDiarySummary(category, detail, memo = "") {
  return JSON.stringify({ version: 1, category, memo, detail });
}

function encodeDoseCareNote(note) {
  const careNote = { version: 1 };
  for (const key of ["conditionName", "dosageLabel", "administeredAmount", "reactionNote"]) {
    if (note[key]) careNote[key] = note[key];
  }
  return JSON.stringify(careNote);
}

// --- Supabase helpers ---------------------------------------------------------

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((user) => (user.email ?? "").toLowerCase() === target);
    if (found) return found;
    if (users.length < 200) return null;
  }
  return null;
}

// Recursively remove every object under a pet's Storage prefix. Storage list()
// is not recursive and synthesizes folder entries with a null id, so we walk
// folders depth-first. Mirrors supabase/functions/delete-account/index.ts.
async function purgePetMedia(client, petId) {
  const prefixes = [petId];
  while (prefixes.length > 0) {
    const prefix = prefixes.pop();
    const files = [];
    let offset = 0;
    for (;;) {
      const { data: entries, error } = await client.storage
        .from(STORAGE_BUCKET)
        .list(prefix, { limit: STORAGE_PAGE_SIZE, offset });
      if (error) throw error;
      if (!entries || entries.length === 0) break;
      for (const entry of entries) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) prefixes.push(path);
        else files.push(path);
      }
      if (entries.length < STORAGE_PAGE_SIZE) break;
      offset += entries.length;
    }
    for (let start = 0; start < files.length; start += STORAGE_PAGE_SIZE) {
      const { error: removeError } = await client.storage
        .from(STORAGE_BUCKET)
        .remove(files.slice(start, start + STORAGE_PAGE_SIZE));
      if (removeError) throw removeError;
    }
  }
}

async function insertRows(admin, table, rows) {
  const { data, error } = await admin.from(table).insert(rows).select();
  if (error) throw new Error(`insert into ${table} failed: ${error.message}`);
  return data;
}

// --- seeding steps ------------------------------------------------------------

async function resetExistingAccount(admin, email) {
  const existing = await findUserByEmail(admin, email);
  if (!existing) {
    log("No existing demo account found; creating fresh.");
    return;
  }
  log(`Existing demo account found (${existing.id}); purging before re-seed.`);
  const { data: ownedPets, error } = await admin.from("pets").select("id").eq("owner_id", existing.id);
  if (error) throw new Error(`failed to list owned pets: ${error.message}`);
  for (const pet of ownedPets ?? []) {
    await purgePetMedia(admin, String(pet.id));
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
  if (deleteError) throw new Error(`failed to delete existing user: ${deleteError.message}`);
  log("Existing demo account and its Storage objects removed.");
}

async function createDemoUser(admin, email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { seeded: true, purpose: "app-review-demo" },
  });
  if (error || !data?.user) {
    throw new Error(`createUser failed: ${error ? error.message : "no user returned"}`);
  }
  const userId = data.user.id;
  // The on_auth_user_created trigger inserts profiles automatically; upsert here
  // so the row is guaranteed even if the trigger is absent on the target project.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, email, language: "en" }, { onConflict: "id" });
  if (profileError) throw new Error(`profile upsert failed: ${profileError.message}`);
  log(`Created demo user ${userId} (email confirmed) and ensured profile row.`);
  return userId;
}

async function seedPet(admin, userId) {
  const [pet] = await insertRows(admin, "pets", [
    {
      owner_id: userId,
      name: "Mochi",
      species: "dog",
      breed: "Shiba Inu",
      birthdate: "2021-03-14",
      weight_kg: 8.4,
    },
  ]);
  // pets_add_owner_membership trigger inserts the owner pet_members row; ensure it.
  const { data: membership, error } = await admin
    .from("pet_members")
    .select("id")
    .eq("pet_id", pet.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`membership check failed: ${error.message}`);
  if (!membership) {
    await insertRows(admin, "pet_members", [{ pet_id: pet.id, user_id: userId, role: "owner" }]);
    log("Owner membership was missing; inserted manually.");
  }
  log(`Seeded pet ${pet.id} (Mochi) with owner membership.`);
  return pet.id;
}

async function seedCare(admin, userId, petId) {
  const [condition] = await insertRows(admin, "conditions", [
    {
      pet_id: petId,
      name: "Skin allergy",
      status: "active",
      vet_instructions: "Give one antihistamine tablet each morning with food.",
      starts_on: sydneyDateDaysAgo(20),
      created_by: userId,
    },
  ]);

  const [medication] = await insertRows(admin, "medications", [
    {
      pet_id: petId,
      condition_id: condition.id,
      name: "Apoquel",
      dosage_label: "1 tablet (5.4 mg)",
      vet_instructions: "Once daily in the morning.",
      created_by: userId,
    },
  ]);

  const [schedule] = await insertRows(admin, "medication_schedules", [
    {
      pet_id: petId,
      medication_id: medication.id,
      local_time: "08:00:00",
      starts_on: sydneyDateDaysAgo(20),
      recurrence_interval_days: 1,
      created_by: userId,
    },
  ]);

  // 6 doses over the last 6 days; distinct dose_date satisfies the
  // (pet_id, schedule_id, dose_date) unique index.
  const doseStatuses = [
    { day: 6, status: "completed" },
    { day: 5, status: "completed" },
    { day: 4, status: "partial", reactionNote: "Spat out half; re-dosed successfully." },
    { day: 3, status: "completed" },
    { day: 2, status: "skipped", reactionNote: "Owner away; dose missed." },
    { day: 1, status: "completed" },
  ];
  const doseRows = doseStatuses.map(({ day, status, reactionNote }) => {
    const doseDate = sydneyDateDaysAgo(day);
    const scheduledAt = sydneyInstant(doseDate, 8, 0);
    const recorded = status === "pending" ? null : sydneyInstant(doseDate, 8, 15).toISOString();
    return {
      pet_id: petId,
      schedule_id: schedule.id,
      medication_name: medication.name,
      scheduled_at: scheduledAt.toISOString(),
      dose_date: doseDate,
      status,
      recorded_at: recorded,
      reaction_note: encodeDoseCareNote({
        conditionName: condition.name,
        dosageLabel: medication.dosage_label,
        administeredAmount:
          status === "completed" ? "1 tablet" : status === "partial" ? "0.5 tablet" : undefined,
        reactionNote,
      }),
      client_mutation_id: randomUUID(),
      created_by: userId,
    };
  });
  await insertRows(admin, "medication_doses", doseRows);
  log(`Seeded 1 condition, 1 medication, 1 schedule and ${doseRows.length} doses.`);
}

async function seedDiary(admin, userId, petId) {
  const entries = [
    {
      day: 1,
      hh: 9,
      mm: 0,
      category: "food",
      detail: {
        category: "food",
        meals: {
          breakfast: { offeredGrams: "150", eatenGrams: "150" },
          dinner: { offeredGrams: "150", eatenGrams: "120" },
        },
        appetite: "good",
      },
      memo: "Ate breakfast eagerly.",
    },
    {
      day: 2,
      hh: 18,
      mm: 30,
      category: "walk",
      detail: {
        category: "walk",
        durationMinutes: "30",
        intensity: "normal",
        observation: "Calm evening walk around the block.",
      },
      memo: "",
    },
    {
      day: 3,
      hh: 7,
      mm: 45,
      category: "stool",
      detail: { category: "stool", count: "1", consistency: "normal", hasBloodOrMucus: false },
      memo: "",
    },
    {
      day: 4,
      hh: 20,
      mm: 0,
      category: "condition",
      conditionScore: 4,
      detail: { category: "condition", energyLevel: "normal", discomfortNote: "Slight itching improved." },
      memo: "Less scratching than last week.",
    },
  ];

  const rows = entries.map((entry) => {
    const entryDate = sydneyDateDaysAgo(entry.day);
    const occurredAt = sydneyInstant(entryDate, entry.hh, entry.mm);
    return {
      pet_id: petId,
      created_by: userId,
      category: entry.category,
      entry_date: entryDate,
      occurred_at: occurredAt.toISOString(),
      summary: encodeDiarySummary(entry.category, entry.detail, entry.memo),
      // CHECK: condition rows require a score; all other categories require null.
      condition_score: entry.category === "condition" ? entry.conditionScore : null,
      record_origin: "diary",
      client_mutation_id: randomUUID(),
    };
  });
  await insertRows(admin, "diary_entries", rows);
  log(`Seeded ${rows.length} diary entries (food, walk, stool, condition).`);
}

async function seedMeasurements(admin, userId, petId) {
  const rows = [
    {
      pet_id: petId,
      kind: "weight_kg",
      value: 8.4,
      measured_at: sydneyInstant(sydneyDateDaysAgo(1), 8, 0).toISOString(),
      created_by: userId,
    },
    {
      pet_id: petId,
      kind: "water_ml",
      value: 320,
      measured_at: sydneyInstant(sydneyDateDaysAgo(3), 20, 0).toISOString(),
      created_by: userId,
    },
  ];
  await insertRows(admin, "measurements", rows);
  log(`Seeded ${rows.length} measurements (weight_kg, water_ml).`);
}

async function seedProfilePhoto(userClient, petId) {
  const fileBody = readFileSync(PET_PHOTO_PATH);
  const storagePath = `${petId}/profile/${randomUUID()}.png`;
  // Upload as the signed-in demo user so Storage records owner_id = user; the
  // replace_pet_profile_photo_v1 RPC requires that ownership before registering
  // the media_assets row (the canonical in-app profile-photo path).
  const { error: uploadError } = await userClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBody, { contentType: "image/png", upsert: true });
  if (uploadError) throw new Error(`photo upload failed: ${uploadError.message}`);

  const { error: rpcError } = await userClient.rpc("replace_pet_profile_photo_v1", {
    p_pet_id: petId,
    p_storage_path: storagePath,
    p_content_type: "image/png",
  });
  if (rpcError) throw new Error(`profile photo registration RPC failed: ${rpcError.message}`);
  log(`Uploaded and registered pet profile photo at ${storagePath}.`);
}

async function generateVetReport(userClient, session, petId) {
  // Invoke the real generate-vet-report edge function with the demo user's own
  // access token (verify_jwt = true) so the produced draft is identical to what
  // the app creates and the Reports tab renders it natively.
  const { data, error } = await userClient.functions.invoke("generate-vet-report", {
    body: { petId, rangeDays: REPORT_RANGE_DAYS },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    const detail = error?.context ? await safeReadFunctionError(error.context) : error.message;
    throw new Error(`generate-vet-report invocation failed: ${detail}`);
  }
  log(`Generated vet report draft ${data?.reportId ?? "(id unknown)"} over ${REPORT_RANGE_DAYS} days.`);
}

async function safeReadFunctionError(context) {
  try {
    const body = await context.json();
    return body?.error ?? JSON.stringify(body);
  } catch {
    return "unknown edge function error";
  }
}

// --- main ---------------------------------------------------------------------

async function main() {
  const { skipPhoto } = parseArgs(process.argv);
  const env = readEnv();
  const createClient = loadCreateClient();

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(env.supabaseUrl, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  log(`Seeding demo account ${env.email} against ${env.supabaseUrl}`);

  await resetExistingAccount(admin, env.email);
  const userId = await createDemoUser(admin, env.email, env.password);
  const petId = await seedPet(admin, userId);
  await seedCare(admin, userId, petId);
  await seedDiary(admin, userId, petId);
  await seedMeasurements(admin, userId, petId);

  const { data: signIn, error: signInError } = await userClient.auth.signInWithPassword({
    email: env.email,
    password: env.password,
  });
  if (signInError || !signIn?.session) {
    throw new Error(`demo user sign-in failed: ${signInError ? signInError.message : "no session"}`);
  }

  if (skipPhoto) {
    log("Skipping pet profile photo (--skip-photo).");
  } else {
    await seedProfilePhoto(userClient, petId);
  }

  await generateVetReport(userClient, signIn.session, petId);
  await userClient.auth.signOut();

  log("Demo account seed complete: Today, Diary, Care and Reports tabs are populated.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});
