const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

const root = process.cwd();
const settingsHub = readFileSync(`${root}/apps/mobile/src/presentation/screens/SettingsHubScreen.tsx`, "utf8");
const planCard = readFileSync(`${root}/apps/mobile/src/contexts/subscription/ui/SubscriptionPlanCard.tsx`, "utf8");
const shell = readFileSync(`${root}/apps/mobile/src/presentation/PawBloomShell.tsx`, "utf8");
const members = readFileSync(`${root}/apps/mobile/src/contexts/pet/ui/PetMembersCard.tsx`, "utf8");
const onboarding = readFileSync(`${root}/apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`, "utf8");

if (settingsHub.includes("SubscriptionPlanCard") || settingsHub.includes("useSubscriptionEntitlement")) {
  throw new Error("free v1 settings must not expose unavailable subscription plans, including in preview");
}

if (!planCard.includes('t("settings.planPreview")') || !planCard.includes("!preview && entitlement")) {
  throw new Error("preview plan cards must show neutral copy without plan-specific limits");
}

if (members.includes("useInvitePetMember") || members.includes('t("settings.membersFamilyLocked")')) {
  throw new Error("free v1 must not expose caregiver invitations or unavailable Family-plan locks");
}
if (!members.includes("useRemovePetMember") || !members.includes("hasSharedAccess") || !members.includes("membersQuery.refetch()")) {
  throw new Error("existing shared access must remain reviewable and removable, including after a failed load");
}
if (!onboarding.includes("ownedPetCount === 0 && entitlement && canCreatePet(entitlement, ownedPetCount)")
  || onboarding.includes('t("pet.planLimitReached")')) {
  throw new Error("free v1 must retain first-pet entitlement checks without unavailable additional-pet entrypoints");
}

if (!shell.includes('if (!databaseMode)') || !shell.includes('setNotice(t("pet.loginRequired"), "info")')) {
  throw new Error("preview profile links must explain that an account is required");
}

for (const guardedLink of ["onOpenProfileCare={openPetSettings}", "onOpenPetProfiles={openPetSettings}"]) {
  if (!shell.includes(guardedLink)) throw new Error(`preview link bypasses the account gate: ${guardedLink}`);
}
