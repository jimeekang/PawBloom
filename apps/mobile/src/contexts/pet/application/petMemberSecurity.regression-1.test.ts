declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { PetMemberRequestError, parsePetMemberRequest } = require(
  "../../../../../../supabase/functions/manage-pet-members/contract.ts",
) as {
  PetMemberRequestError: new (message: string) => Error;
  parsePetMemberRequest(input: unknown):
    | { action: "list"; petId: string }
    | { action: "invite"; petId: string; email: string }
    | { action: "remove"; petId: string; membershipId: string };
};

const root = process.cwd();
const migration = readFileSync(
  `${root}/supabase/migrations/20260716112929_secure_family_memberships_and_entitlements.sql`,
  "utf8",
).toLowerCase();
const profileIdentityMigration = readFileSync(
  `${root}/supabase/migrations/20260716114749_protect_profile_identity.sql`,
  "utf8",
).toLowerCase();
const serializedLimitMigration = readFileSync(
  `${root}/supabase/migrations/20260716121500_serialize_pet_entitlement_limits.sql`,
  "utf8",
).toLowerCase();
const canonicalOwnerMigration = readFileSync(
  `${root}/supabase/migrations/20260716123000_enforce_canonical_pet_owner_membership.sql`,
  "utf8",
).toLowerCase();
const exactEmailLookupMigration = readFileSync(
  `${root}/supabase/migrations/20260723090000_exact_profile_email_lookup.sql`,
  "utf8",
).toLowerCase();
const functionSource = readFileSync(`${root}/supabase/functions/manage-pet-members/index.ts`, "utf8");
const memberClient = readFileSync(`${root}/apps/mobile/src/contexts/pet/application/petMembers.ts`, "utf8");
const config = readFileSync(`${root}/supabase/config.toml`, "utf8");
const settings = readFileSync(`${root}/apps/mobile/src/presentation/screens/SettingsHubScreen.tsx`, "utf8");
const onboarding = readFileSync(`${root}/apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`, "utf8");
const authQueries = readFileSync(`${root}/apps/mobile/src/contexts/identity/application/authContextQueries.ts`, "utf8");

const invite = parsePetMemberRequest({
  action: "invite",
  petId: "pet-1",
  email: " CAREGIVER@EXAMPLE.COM ",
});
if (invite.action !== "invite" || invite.email !== "caregiver@example.com") {
  throw new Error("caregiver invites must normalize email before privileged lookup");
}

for (const email of ["percent%tag@example.com", "under_score@example.com", "back\\slash@example.com"]) {
  const wildcardInvite = parsePetMemberRequest({ action: "invite", petId: "pet-1", email });
  if (wildcardInvite.action !== "invite" || wildcardInvite.email !== email) {
    throw new Error("valid email punctuation must survive normalization for exact lookup");
  }
}

for (const invalid of [
  null,
  {},
  { action: "invite", petId: "pet-1", email: "invalid" },
  { action: "remove", petId: "pet-1" },
]) {
  let thrown: unknown;
  try {
    parsePetMemberRequest(invalid);
  } catch (error) {
    thrown = error;
  }
  if (!(thrown instanceof PetMemberRequestError)) {
    throw new Error("member management must reject malformed privileged requests");
  }
}

for (const required of [
  "requirepetowner(supabase, body.petid, user.id)",
  '.eq("owner_id", userid)',
  "supabase.auth.admin.inviteuserbyemail",
  'role: "caregiver"',
  'data?.plan !== "family"',
  'membership.role === "owner"',
]) {
  if (!functionSource.toLowerCase().includes(required)) {
    throw new Error(`pet member function security guard is missing: ${required}`);
  }
}

if (functionSource.includes('.ilike("email"') || !functionSource.includes('.rpc("lookup_profile_id_by_email"')) {
  throw new Error("privileged caregiver lookup must use exact normalized equality, never a wildcard filter");
}
for (const required of [
  "where lower(profile.email) = lower(pg_catalog.btrim(target_email))",
  "revoke all on function public.lookup_profile_id_by_email(text) from public, anon, authenticated",
  "grant execute on function public.lookup_profile_id_by_email(text) to service_role",
]) {
  if (!exactEmailLookupMigration.includes(required)) {
    throw new Error(`exact caregiver identity lookup guard is missing: ${required}`);
  }
}

for (const required of [
  'revoke insert, update, delete on public.pet_members from authenticated',
  'drop policy if exists "pet_members owners update"',
  'drop policy if exists "pet_members owners delete"',
  'revoke insert, update, delete on public.subscription_entitlements from authenticated',
  'drop policy if exists "subscription own update"',
  "app_private.can_create_pet",
]) {
  if (!migration.includes(required)) {
    throw new Error(`membership/entitlement migration guard is missing: ${required}`);
  }
}

if (!config.includes("[functions.manage-pet-members]") || !config.includes("verify_jwt = true")) {
  throw new Error("caregiver management must require a verified user JWT");
}
if (!settings.includes("<PetMembersCard") || !settings.includes("<SubscriptionPlanCard")) {
  throw new Error("Settings must expose care-team management and the current entitlement state");
}
if (!onboarding.includes("canCreatePet(entitlement, ownedPetCount)") || !onboarding.includes("countOwnedPets(pets)")) {
  throw new Error("pet creation UI must count only owned pets when applying the database plan limit");
}
for (const required of [
  'revoke insert, update on public.profiles from authenticated',
  'drop policy if exists "profiles own update"',
  "from auth.users auth_user",
  "after insert or update of email on auth.users",
]) {
  if (!profileIdentityMigration.includes(required)) {
    throw new Error(`profile identity guard is missing: ${required}`);
  }
}
if (authQueries.includes(".upsert(") || !authQueries.includes('.select("id")')) {
  throw new Error("the client must verify its server-created profile without writing identity email");
}
for (const required of [
  "pg_advisory_xact_lock",
  "effective_subscription_plan(new.owner_id)",
  "pet_plan_limit_reached",
  "before insert on public.pets",
]) {
  if (!serializedLimitMigration.includes(required)) {
    throw new Error(`concurrent pet entitlement guard is missing: ${required}`);
  }
}
if (!memberClient.includes('if (!member) throw new PetMemberRequestError("memberRequestFailed")')) {
  throw new Error("the caregiver UI must reject malformed successful function responses");
}
for (const required of [
  "pet_members_one_owner_idx",
  "membership.user_id <> pet.owner_id",
  "canonical_owner_role_required",
  "owner_role_must_match_pet_owner",
  "before insert or update of pet_id, user_id, role",
]) {
  if (!canonicalOwnerMigration.includes(required)) {
    throw new Error(`canonical pet owner guard is missing: ${required}`);
  }
}
