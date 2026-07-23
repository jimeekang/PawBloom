declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: A1 — privacy policy and support links must stay reachable in-app
// Part of docs/exec-plans/active/0006-uiux-alignment-plan.md (app-store readiness)

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const config = read("shared-kernel/config.ts");
const translations = read("i18n/translations.ts");
const settingsScreen = read("contexts/identity/ui/SettingsScreen.tsx");
const authScreen = read("contexts/identity/ui/AuthScreen.tsx");

if (!config.includes("export const PRIVACY_POLICY_URL") || !config.includes("export const SUPPORT_URL")) {
  throw new Error("config must export PRIVACY_POLICY_URL and SUPPORT_URL constants");
}

for (const key of ['"settings.privacyPolicy"', '"settings.support"']) {
  if (occurrences(translations, key) < 2) {
    throw new Error(`${key} must be defined in both en and ko translations`);
  }
}

for (const [name, source] of [["SettingsScreen", settingsScreen], ["AuthScreen", authScreen]] as const) {
  if (!source.includes("PRIVACY_POLICY_URL") || !source.includes("SUPPORT_URL")) {
    throw new Error(`${name} must open the privacy policy and support URLs`);
  }
  if (occurrences(source, 'accessibilityRole="link"') < 2) {
    throw new Error(`${name} must expose both policy links with accessibilityRole="link"`);
  }
}
