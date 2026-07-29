const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

const root = process.cwd();
const settingsHub = readFileSync(`${root}/apps/mobile/src/presentation/screens/SettingsHubScreen.tsx`, "utf8");
const planCard = readFileSync(`${root}/apps/mobile/src/contexts/subscription/ui/SubscriptionPlanCard.tsx`, "utf8");
const shell = readFileSync(`${root}/apps/mobile/src/presentation/PawBloomShell.tsx`, "utf8");

if (settingsHub.includes("entitlements.plus") || !settingsHub.includes("preview={!configured}")) {
  throw new Error("preview settings must not claim a concrete subscription plan");
}

if (!planCard.includes('t("settings.planPreview")') || !planCard.includes("!preview && entitlement")) {
  throw new Error("preview plan cards must show neutral copy without plan-specific limits");
}

if (!shell.includes('if (!databaseMode)') || !shell.includes('setNotice(t("pet.loginRequired"), "info")')) {
  throw new Error("preview profile links must explain that an account is required");
}

for (const guardedLink of ["onOpenProfileCare={openPetSettings}", "onOpenPetProfiles={openPetSettings}"]) {
  if (!shell.includes(guardedLink)) throw new Error(`preview link bypasses the account gate: ${guardedLink}`);
}
