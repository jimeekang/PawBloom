declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 A2 — account deletion must confirm through the shared
// confirmDestructiveAction (web-safe, unlike raw Alert.alert), surface an
// in-progress state while the edge function runs, and announce success on
// the auth gate after sign-out.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const settingsScreen = read("contexts/identity/ui/SettingsScreen.tsx");
const translations = read("i18n/translations.ts");
const accountDeletion = read("contexts/identity/application/useAccountDeletion.ts");
const identityMessage = read("contexts/identity/application/identityMessage.ts");

if (settingsScreen.includes("Alert.alert")) {
  throw new Error("SettingsScreen must not use raw Alert.alert (web no-op); use confirmDestructiveAction");
}

if (!settingsScreen.includes("confirmDestructiveAction")) {
  throw new Error("SettingsScreen must confirm account deletion via confirmDestructiveAction");
}

const dangerButton = read("design-system/feedback.tsx");
if (!settingsScreen.includes("settings.deleteAccountInProgress") || !settingsScreen.includes("busy={deleting}") || !dangerButton.includes("ActivityIndicator")) {
  throw new Error("SettingsScreen must show a deleting progress state (DangerButton busy spinner + settings.deleteAccountInProgress)");
}

for (const key of ['"settings.deleteAccountInProgress"', '"auth.accountDeleted"']) {
  if (occurrences(translations, key) < 2) {
    throw new Error(`${key} must be defined in both en and ko translations`);
  }
}

if (!identityMessage.includes('"auth.accountDeleted"')) {
  throw new Error("IdentityMessageKey must include auth.accountDeleted");
}

if (!accountDeletion.includes("announceAccountDeleted")) {
  throw new Error("useAccountDeletion must announce deletion success on the auth gate after sign-out");
}
